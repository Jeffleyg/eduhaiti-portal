import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { buildAuditData } from '../common/audit-compat';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { EmailService } from '../common/services/email.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

// Brute-force protection: after MAX_LOGIN_FAILURES wrong passwords for the same
// e-mail within LOGIN_WINDOW_MS, the account is locked for LOGIN_LOCK_MS.
const MAX_LOGIN_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

// Password reset links are single-use, expire after RESET_TOKEN_TTL_MS and at
// most one is issued per account every RESET_THROTTLE_MS (anti e-mail spam).
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const RESET_THROTTLE_MS = 60 * 1000;
const INVALID_RESET_LINK = 'Invalid or expired reset link';

const hashResetToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  private readonly loginFailures = new Map<
    string,
    { count: number; firstAt: number; lockedUntil?: number }
  >();

  private assertNotLocked(email: string) {
    const entry = this.loginFailures.get(email);
    if (entry?.lockedUntil && entry.lockedUntil > Date.now()) {
      throw new HttpException(
        'Too many login attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private registerLoginFailure(email: string) {
    const now = Date.now();
    const entry = this.loginFailures.get(email);
    const fresh = !entry || now - entry.firstAt > LOGIN_WINDOW_MS;
    const next: { count: number; firstAt: number; lockedUntil?: number } = fresh
      ? { count: 1, firstAt: now }
      : { ...entry, count: entry.count + 1 };
    if (next.count >= MAX_LOGIN_FAILURES) {
      next.lockedUntil = now + LOGIN_LOCK_MS;
    }
    this.loginFailures.set(email, next);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async requestCode(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          role: Role.STUDENT,
        },
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const ttlMinutes = Number(
      this.configService.get('AUTH_CODE_TTL_MINUTES') ?? 10,
    );
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.prisma.loginCode.deleteMany({
      where: {
        email: normalizedEmail,
        consumedAt: null,
      },
    });

    await this.prisma.loginCode.create({
      data: {
        email: normalizedEmail,
        codeHash,
        expiresAt,
        userId: user.id,
      },
    });

    const response: { delivered: boolean; devCode?: string } = {
      delivered: true,
    };

    if (
      (this.configService.get('NODE_ENV') ?? 'development') !== 'production'
    ) {
      response.devCode = code;
    }

    return response;
  }

  async verifyCode(email: string, code: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const loginCode = await this.prisma.loginCode.findFirst({
      where: {
        email: normalizedEmail,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!loginCode) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const isValid = await bcrypt.compare(code, loginCode.codeHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        isActive: true,
        mustChangePassword: true,
        enrollmentNumber: true,
        profilePhoto: true,
        schoolId: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not available');
    }

    await this.prisma.loginCode.update({
      where: { id: loginCode.id },
      data: { consumedAt: new Date() },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    };
    const token = await this.jwtService.signAsync(payload);

    return {
      token,
      user,
    };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        firstName: true,
        lastName: true,
        profilePhoto: true,
        dateOfBirth: true,
        address: true,
        gender: true,
        fatherName: true,
        motherName: true,
        isActive: true,
        mustChangePassword: true,
        enrollmentNumber: true,
        schoolId: true,
        classesAttending: {
          select: { id: true, name: true, level: true },
        },
        classesTeaching: {
          select: { id: true, name: true, level: true },
        },
      },
    });
  }

  async updateProfile(userId: string, payload: UpdateProfileDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const firstName = payload.firstName ?? existing.firstName ?? '';
    const lastName = payload.lastName ?? existing.lastName ?? '';
    const fullName = `${firstName} ${lastName}`.trim() || null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        name: fullName,
        dateOfBirth: payload.dateOfBirth
          ? new Date(payload.dateOfBirth)
          : undefined,
        address: payload.address,
        gender: payload.gender,
        fatherName: payload.fatherName,
        motherName: payload.motherName,
        profilePhoto: payload.profilePhoto,
      },
    });

    return this.getProfile(userId);
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    this.assertNotLocked(normalizedEmail);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        isActive: true,
        passwordHash: true,
        mustChangePassword: true,
        tempPasswordExpiresAt: true,
        enrollmentNumber: true,
        profilePhoto: true,
        schoolId: true,
      },
    });

    if (!user || !user.isActive || !user.passwordHash) {
      await this.logAccessEvent({
        action: 'LOGIN_FAILED',
        entityId: normalizedEmail,
        details: {
          reason: 'invalid_credentials_or_inactive',
          email: normalizedEmail,
        },
      });
      this.registerLoginFailure(normalizedEmail);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.tempPasswordExpiresAt && user.tempPasswordExpiresAt < new Date()) {
      await this.logAccessEvent({
        action: 'LOGIN_FAILED',
        entityId: user.id,
        userId: user.id,
        details: {
          reason: 'temporary_password_expired',
          email: user.email,
        },
      });
      throw new UnauthorizedException('Temporary password expired');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      await this.logAccessEvent({
        action: 'LOGIN_FAILED',
        entityId: user.id,
        userId: user.id,
        details: {
          reason: 'invalid_credentials',
          email: user.email,
        },
      });
      this.registerLoginFailure(normalizedEmail);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.loginFailures.delete(normalizedEmail);
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    };
    const token = await this.jwtService.signAsync(payload);

    const responseUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      enrollmentNumber: user.enrollmentNumber,
      profilePhoto: user.profilePhoto,
      schoolId: user.schoolId,
    };

    await this.logAccessEvent({
      action: 'LOGIN_SUCCESS',
      entityId: user.id,
      userId: user.id,
      details: {
        email: user.email,
        role: user.role,
      },
    });

    return { token, user: responseUser };
  }

  async logout(userId: string, email?: string) {
    await this.logAccessEvent({
      action: 'LOGOUT',
      entityId: userId || email || 'unknown',
      userId: userId || undefined,
      details: {
        email: email ?? null,
      },
    });

    return { success: true };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
      },
    });

    return { success: true };
  }

  async signup(email: string, name: string, role: Role) {
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('User already exists with this email');
    }

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        role,
      },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        isActive: true,
        schoolId: true,
      },
    });

    return user;
  }

  /**
   * Starts a password reset. The answer is the same whether or not the e-mail
   * belongs to an account, so the endpoint cannot be used to discover users.
   */
  async forgotPassword(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const response: { success: true; devResetUrl?: string } = {
      success: true,
    };

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return response;
    }

    const recent = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: new Date(Date.now() - RESET_THROTTLE_MS) },
      },
      select: { id: true },
    });
    if (recent) {
      return response;
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt },
    });

    const resetUrl = `${this.frontendUrl()}/reset-password?token=${token}`;
    const delivered = await this.emailService.sendPasswordResetEmail(
      user.email,
      resetUrl,
      expiresAt,
    );

    await this.logAccessEvent({
      action: 'PASSWORD_RESET_REQUESTED',
      entityId: user.id,
      userId: user.id,
      details: { email: user.email, delivered },
    });

    // Without SMTP in development the link is returned so the flow can be tested.
    if (!delivered && !this.isProduction()) {
      response.devResetUrl = resetUrl;
    }
    return response;
  }

  /** Tells the reset page up front whether its link can still be used. */
  async checkResetToken(token: string) {
    const record = await this.findUsableResetToken(token);
    return { valid: Boolean(record) };
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.findUsableResetToken(token);
    if (!record) {
      throw new BadRequestException(INVALID_RESET_LINK);
    }

    // Claim the token atomically so two concurrent submits cannot both succeed.
    const claimed = await this.prisma.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException(INVALID_RESET_LINK);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
      },
    });
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId, usedAt: null },
    });

    this.loginFailures.delete(record.user.email);
    await this.logAccessEvent({
      action: 'PASSWORD_RESET',
      entityId: record.userId,
      userId: record.userId,
      details: { email: record.user.email },
    });

    return { success: true };
  }

  private async findUsableResetToken(token: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      select: {
        id: true,
        userId: true,
        usedAt: true,
        expiresAt: true,
        user: { select: { email: true, isActive: true } },
      },
    });
    if (
      !record ||
      record.usedAt ||
      record.expiresAt <= new Date() ||
      !record.user.isActive
    ) {
      return null;
    }
    return record;
  }

  private isProduction() {
    return (
      (this.configService.get('NODE_ENV') ?? 'development') === 'production'
    );
  }

  private frontendUrl() {
    const configured =
      this.configService.get<string>('FRONTEND_URL') ??
      this.configService.get<string>('CORS_ORIGIN')?.split(',')[0];
    return (configured?.trim() || 'http://localhost:5173').replace(/\/+$/, '');
  }

  getTestCredentials() {
    if (this.isProduction()) {
      throw new NotFoundException('Not found');
    }

    // Same default as prisma/seed.ts (DEFAULT_SEED_PASSWORD), so the
    // one-click test accounts on the login page actually work.
    const seedPassword =
      this.configService.get<string>('DEFAULT_SEED_PASSWORD') ?? 'Password@123';
    const pick = (key: string) =>
      this.configService.get<string>(key) ?? seedPassword;
    return {
      admin: {
        role: Role.ADMIN,
        email: 'admin@eduhaiti.ht',
        password: pick('ADMIN_PASSWORD'),
      },
      teacher: {
        role: Role.TEACHER,
        email: 'professeur@eduhaiti.ht',
        password: pick('TEACHER_PASSWORD'),
      },
      student: {
        role: Role.STUDENT,
        email: 'eleve@eduhaiti.ht',
        password: pick('STUDENT_PASSWORD'),
      },
      owner: {
        role: Role.OWNER,
        email: 'owner@eduhaiti.ht',
        password: pick('OWNER_PASSWORD'),
      },
    };
  }

  private async logAccessEvent(params: {
    action: string;
    entityId: string;
    userId?: string;
    details: Record<string, unknown>;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: buildAuditData({
          entityType: 'AUTH_ACCESS',
          entityId: params.entityId,
          action: params.action,
          userId: params.userId,
          changes: { at: new Date().toISOString(), ...params.details },
        }),
      });
    } catch {
      // Do not block authentication flow if audit logging fails.
    }
  }
}
