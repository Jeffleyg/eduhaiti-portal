import { Injectable } from "@nestjs/common"
import { PrismaService } from "../../prisma/prisma.service"

type OtpIssuePayload = {
  phone: string
  studentId: string
  tokenHint?: string
  otpCode: string
  expiresAt: string
}

@Injectable()
export class HybridOtpService {
  private readonly ttlMs = 5 * 60 * 1000

  constructor(private readonly prisma: PrismaService) {}

  private normalizePhone(phone: string) {
    return phone.replace(/\D/g, "")
  }

  private normalizeToken(token?: string) {
    return (token ?? "").replace(/\D/g, "")
  }

  private makeEntityId(phone: string, studentId: string) {
    return `${this.normalizePhone(phone)}:${studentId}`
  }

  async issueOtp(params: { phone: string; studentId: string; tokenHint?: string }) {
    const otpCode = String(Math.floor(100000 + Math.random() * 900000))
    const entityId = this.makeEntityId(params.phone, params.studentId)
    const expiresAt = new Date(Date.now() + this.ttlMs).toISOString()

    const payload: OtpIssuePayload = {
      phone: this.normalizePhone(params.phone),
      studentId: params.studentId,
      tokenHint: this.normalizeToken(params.tokenHint) || undefined,
      otpCode,
      expiresAt,
    }

    await this.prisma.auditLog.create({
      data: {
        entityType: "HYBRID_OTP",
        entityId,
        action: "ISSUE",
        changes: JSON.stringify(payload),
      },
    })

    return { otpCode, expiresAt }
  }

  async verifyOtp(params: {
    phone: string
    studentId: string
    otpCode?: string
    tokenHint?: string
  }) {
    if (!params.otpCode?.trim()) {
      return { ok: false as const, reason: "missing" }
    }

    const entityId = this.makeEntityId(params.phone, params.studentId)
    const latestIssue = await this.prisma.auditLog.findFirst({
      where: {
        entityType: "HYBRID_OTP",
        entityId,
        action: "ISSUE",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        changes: true,
      },
    })

    if (!latestIssue) {
      return { ok: false as const, reason: "not-issued" }
    }

    let payload: OtpIssuePayload | null = null
    try {
      payload = JSON.parse(latestIssue.changes) as OtpIssuePayload
    } catch {
      payload = null
    }

    if (!payload) {
      return { ok: false as const, reason: "invalid-payload" }
    }

    const now = Date.now()
    const expiry = new Date(payload.expiresAt).getTime()
    if (!Number.isFinite(expiry) || now > expiry) {
      await this.prisma.auditLog.create({
        data: {
          entityType: "HYBRID_OTP",
          entityId,
          action: "VERIFY_EXPIRED",
          changes: JSON.stringify({ issueLogId: latestIssue.id }),
        },
      })
      return { ok: false as const, reason: "expired" }
    }

    if (this.normalizePhone(params.phone) !== payload.phone) {
      return { ok: false as const, reason: "phone-mismatch" }
    }

    const expectedToken = payload.tokenHint ?? ""
    const providedToken = this.normalizeToken(params.tokenHint)
    if (expectedToken && providedToken && expectedToken !== providedToken) {
      return { ok: false as const, reason: "token-mismatch" }
    }

    const ok = payload.otpCode === params.otpCode.trim()
    await this.prisma.auditLog.create({
      data: {
        entityType: "HYBRID_OTP",
        entityId,
        action: ok ? "VERIFY_OK" : "VERIFY_FAIL",
        changes: JSON.stringify({ issueLogId: latestIssue.id }),
      },
    })

    return ok ? { ok: true as const } : { ok: false as const, reason: "wrong-code" }
  }
}
