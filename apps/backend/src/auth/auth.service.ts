import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { ConfigService } from "@nestjs/config"
import { PrismaService } from "../prisma/prisma.service"
import { Role } from "@prisma/client"
import bcrypt from "bcryptjs"
import { UpdateProfileDto } from "./dto/update-profile.dto"

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async requestCode(email: string) {
    const normalizedEmail = email.trim().toLowerCase()
    let user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } })

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          role: Role.STUDENT,
        },
      })
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const codeHash = await bcrypt.hash(code, 10)
    const ttlMinutes = Number(this.configService.get("AUTH_CODE_TTL_MINUTES") ?? 10)
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)

    await this.prisma.loginCode.deleteMany({
      where: {
        email: normalizedEmail,
        consumedAt: null,
      },
    })

    await this.prisma.loginCode.create({
      data: {
        email: normalizedEmail,
        codeHash,
        expiresAt,
        userId: user.id,
      },
    })

    const response: { delivered: boolean; devCode?: string } = { delivered: true }

    if ((this.configService.get("NODE_ENV") ?? "development") !== "production") {
      response.devCode = code
    }

    return response
  }

  async verifyCode(email: string, code: string) {
    const normalizedEmail = email.trim().toLowerCase()
    const loginCode = await this.prisma.loginCode.findFirst({
      where: {
        email: normalizedEmail,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    })

    if (!loginCode) {
      throw new UnauthorizedException("Invalid or expired code")
    }

    const isValid = await bcrypt.compare(code, loginCode.codeHash)
    if (!isValid) {
      throw new UnauthorizedException("Invalid or expired code")
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
      },
    })

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Account not available")
    }

    await this.prisma.loginCode.update({
      where: { id: loginCode.id },
      data: { consumedAt: new Date() },
    })

    const payload = { sub: user.id, email: user.email, role: user.role }
    const token = await this.jwtService.signAsync(payload)

    return {
      token,
      user,
    }
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
        dateOfBirth: true,
        address: true,
        gender: true,
        fatherName: true,
        motherName: true,
        isActive: true,
        mustChangePassword: true,
        enrollmentNumber: true,
        classesAttending: {
          select: { id: true, name: true, level: true },
        },
        classesTeaching: {
          select: { id: true, name: true, level: true },
        },
      },
    })
  }

  async updateProfile(userId: string, payload: UpdateProfileDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    })

    if (!existing) {
      throw new UnauthorizedException("Invalid credentials")
    }

    const firstName = payload.firstName ?? existing.firstName ?? ""
    const lastName = payload.lastName ?? existing.lastName ?? ""
    const fullName = `${firstName} ${lastName}`.trim() || null

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        name: fullName,
        dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : undefined,
        address: payload.address,
        gender: payload.gender,
        fatherName: payload.fatherName,
        motherName: payload.motherName,
      },
    })

    return this.getProfile(userId)
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase()
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
      },
    })

    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException("Invalid credentials")
    }

    if (user.tempPasswordExpiresAt && user.tempPasswordExpiresAt < new Date()) {
      throw new UnauthorizedException("Temporary password expired")
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      throw new UnauthorizedException("Invalid credentials")
    }

    const payload = { sub: user.id, email: user.email, role: user.role }
    const token = await this.jwtService.signAsync(payload)

    const responseUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      enrollmentNumber: user.enrollmentNumber,
    }

    return { token, user: responseUser }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    })

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid credentials")
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValid) {
      throw new UnauthorizedException("Invalid credentials")
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
      },
    })

    return { success: true }
  }

  async signup(email: string, name: string, role: Role) {
    const normalizedEmail = email.trim().toLowerCase()
    
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      throw new ConflictException("User already exists with this email")
    }

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        role,
      },
      select: { id: true, email: true, role: true, name: true, isActive: true },
    })

    return user
  }
}
