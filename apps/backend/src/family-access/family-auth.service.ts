import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { HybridOtpService } from '../hybrid-gateway/services/hybrid-otp.service';
import { phonesMatch } from '../hybrid-gateway/services/sql-server-read.service';

/** Codes a single phone/student pair may request per window. */
export const FAMILY_CODE_LIMIT = 3;
export const FAMILY_CODE_WINDOW_MS = 15 * 60 * 1000;
export const FAMILY_SESSION_TTL = '2h';
export const FAMILY_TOKEN_AUDIENCE = 'family-portal';

export type FamilySession = {
  studentId: string;
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
};

/**
 * Family portal login: enrollment number + a guardian phone registered for the student,
 * confirmed by an SMS code. The session token is signed with its own key, so it is never
 * accepted by the staff/student JWT guard.
 */
@Injectable()
export class FamilyAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: HybridOtpService,
    private readonly jwt: JwtService,
  ) {}

  /** Finds the guardian of `enrollmentNumber` whose registered phone matches `phone`. */
  private async findGuardian(enrollmentNumber: string, phone: string) {
    const student = await this.prisma.user.findFirst({
      where: {
        enrollmentNumber: enrollmentNumber?.trim(),
        role: 'STUDENT',
        isActive: true,
      },
      select: {
        id: true,
        guardianLinks: {
          select: {
            guardian: {
              select: { id: true, fullName: true, phoneNumber: true },
            },
          },
        },
      },
    });
    const guardian = student?.guardianLinks
      .map((link) => link.guardian)
      .find((item) => phonesMatch(phone, item.phoneNumber));
    return student && guardian ? { studentId: student.id, guardian } : null;
  }

  /**
   * Sends a code to the guardian's registered phone. Always answers the same way so the
   * endpoint cannot be used to discover which enrollment numbers or phones exist.
   */
  async requestCode(enrollmentNumber: string, phone: string) {
    const generic = { sent: true as const };
    const match = await this.findGuardian(enrollmentNumber, phone);
    if (!match) {
      return generic;
    }

    const recent = await this.otp.countRecentIssues(
      match.guardian.phoneNumber,
      match.studentId,
      FAMILY_CODE_WINDOW_MS,
    );
    if (recent >= FAMILY_CODE_LIMIT) {
      return generic;
    }

    await this.otp.issueOtp({
      phone: match.guardian.phoneNumber,
      studentId: match.studentId,
    });
    return generic;
  }

  async verifyCode(enrollmentNumber: string, phone: string, code: string) {
    const match = await this.findGuardian(enrollmentNumber, phone);
    const invalid = new UnauthorizedException('Invalid or expired code');
    if (!match) {
      throw invalid;
    }

    const result = await this.otp.verifyOtp({
      phone: match.guardian.phoneNumber,
      studentId: match.studentId,
      otpCode: code,
    });
    if (!result.ok) {
      throw invalid;
    }

    const session: FamilySession = {
      studentId: match.studentId,
      guardianId: match.guardian.id,
      guardianName: match.guardian.fullName,
      guardianPhone: match.guardian.phoneNumber,
    };
    const token = await this.jwt.signAsync(
      // `sub` is not the student id, so the token can never pose as a student login.
      { sub: `family:${match.guardian.id}`, ...session },
      { audience: FAMILY_TOKEN_AUDIENCE, expiresIn: FAMILY_SESSION_TTL },
    );
    return { token, guardianName: session.guardianName };
  }

  async readSession(token: string): Promise<FamilySession> {
    try {
      const payload = await this.jwt.verifyAsync<
        FamilySession & { sub: string }
      >(token, {
        audience: FAMILY_TOKEN_AUDIENCE,
      });
      return {
        studentId: payload.studentId,
        guardianId: payload.guardianId,
        guardianName: payload.guardianName,
        guardianPhone: payload.guardianPhone,
      };
    } catch {
      throw new UnauthorizedException('Family session expired');
    }
  }
}
