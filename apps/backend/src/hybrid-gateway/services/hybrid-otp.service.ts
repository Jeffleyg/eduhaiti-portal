import { Injectable } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { buildAuditData, safeParseJson } from '../../common/audit-compat';
import { HybridOutboundSmsService } from './hybrid-outbound-sms.service';

type OtpIssuePayload = {
  phone: string;
  studentId: string;
  tokenHint?: string;
  /** HMAC of the code; the code itself is never stored. */
  otpHash: string;
  expiresAt: string;
};

/** Wrong guesses allowed per issued code before it is burned. */
export const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class HybridOtpService {
  private readonly ttlMs = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboundSms: HybridOutboundSmsService,
  ) {}

  /**
   * Keyed hash: a plain hash of a 6-digit code could be reversed instantly by
   * anyone able to read the audit log.
   */
  private hashOtp(entityId: string, otpCode: string) {
    const key = process.env.HYBRID_OTP_SECRET || process.env.JWT_SECRET || '';
    return createHmac('sha256', key).update(`${entityId}:${otpCode}`).digest('hex');
  }

  private normalizePhone(phone: string) {
    return phone.replace(/\D/g, '');
  }

  private normalizeToken(token?: string) {
    return (token ?? '').replace(/\D/g, '');
  }

  private makeEntityId(phone: string, studentId: string) {
    return `${this.normalizePhone(phone)}:${studentId}`;
  }

  /**
   * Creates a code, stores only its HMAC and sends it by SMS to the caller's phone.
   * The code is returned so non-production builds can echo it when HYBRID_DEBUG_OTP=true.
   */
  async issueOtp(params: {
    phone: string;
    studentId: string;
    tokenHint?: string;
    operatorHint?: string;
  }) {
    const otpCode = String(randomInt(100000, 1000000));
    const entityId = this.makeEntityId(params.phone, params.studentId);
    const expiresAt = new Date(Date.now() + this.ttlMs).toISOString();

    const payload: OtpIssuePayload = {
      phone: this.normalizePhone(params.phone),
      studentId: params.studentId,
      tokenHint: this.normalizeToken(params.tokenHint) || undefined,
      otpHash: this.hashOtp(entityId, otpCode),
      expiresAt,
    };

    await this.prisma.auditLog.create({
      data: buildAuditData({
        entityType: 'HYBRID_OTP',
        entityId,
        action: 'ISSUE',
        changes: payload,
      }),
    });

    await this.outboundSms.sendSms({
      to: params.phone,
      text: `EduHaiti: kod verifikasyon ou se ${otpCode}. Li valab 5 minit.`,
      operatorHint: params.operatorHint,
      context: { purpose: 'HYBRID_OTP', studentId: params.studentId },
    });

    return { otpCode, expiresAt };
  }

  /** Codes issued for this phone/student in the last `windowMs`, to rate-limit requests. */
  async countRecentIssues(phone: string, studentId: string, windowMs: number) {
    return this.prisma.auditLog.count({
      where: {
        entityType: 'HYBRID_OTP',
        entityId: this.makeEntityId(phone, studentId),
        action: 'ISSUE',
        createdAt: { gt: new Date(Date.now() - windowMs) },
      },
    });
  }

  async verifyOtp(params: {
    phone: string;
    studentId: string;
    otpCode?: string;
    tokenHint?: string;
  }) {
    if (!params.otpCode?.trim()) {
      return { ok: false as const, reason: 'missing' };
    }

    const entityId = this.makeEntityId(params.phone, params.studentId);
    const latestIssue = await this.prisma.auditLog.findFirst({
      where: {
        entityType: 'HYBRID_OTP',
        entityId,
        action: 'ISSUE',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        changes: true,
      },
    });

    if (!latestIssue) {
      return { ok: false as const, reason: 'not-issued' };
    }

    const payload = safeParseJson<OtpIssuePayload>(latestIssue.changes);

    if (!payload) {
      return { ok: false as const, reason: 'invalid-payload' };
    }

    const now = Date.now();
    const expiry = new Date(payload.expiresAt).getTime();
    if (!Number.isFinite(expiry) || now > expiry) {
      await this.prisma.auditLog.create({
        data: buildAuditData({
          entityType: 'HYBRID_OTP',
          entityId,
          action: 'VERIFY_EXPIRED',
          changes: { issueLogId: latestIssue.id },
        }),
      });
      return { ok: false as const, reason: 'expired' };
    }

    if (this.normalizePhone(params.phone) !== payload.phone) {
      return { ok: false as const, reason: 'phone-mismatch' };
    }

    const expectedToken = payload.tokenHint ?? '';
    const providedToken = this.normalizeToken(params.tokenHint);
    if (expectedToken && providedToken && expectedToken !== providedToken) {
      return { ok: false as const, reason: 'token-mismatch' };
    }

    const failedAttempts = await this.prisma.auditLog.count({
      where: {
        entityType: 'HYBRID_OTP',
        entityId,
        action: 'VERIFY_FAIL',
        changes: { path: ['issueLogId'], equals: latestIssue.id },
      },
    });
    if (failedAttempts >= MAX_OTP_ATTEMPTS) {
      return { ok: false as const, reason: 'too-many-attempts' };
    }

    const expectedHash = Buffer.from(payload.otpHash ?? '', 'hex');
    const providedHash = Buffer.from(this.hashOtp(entityId, params.otpCode.trim()), 'hex');
    const ok =
      expectedHash.length === providedHash.length &&
      timingSafeEqual(expectedHash, providedHash);
    await this.prisma.auditLog.create({
      data: buildAuditData({
        entityType: 'HYBRID_OTP',
        entityId,
        action: ok ? 'VERIFY_OK' : 'VERIFY_FAIL',
        changes: { issueLogId: latestIssue.id },
      }),
    });

    return ok
      ? { ok: true as const }
      : { ok: false as const, reason: 'wrong-code' };
  }
}
