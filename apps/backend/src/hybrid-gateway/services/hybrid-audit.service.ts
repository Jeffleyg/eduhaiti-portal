import { Injectable } from "@nestjs/common"
import { PrismaService } from "../../prisma/prisma.service"

@Injectable()
export class HybridAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logMessageQuery(payload: {
    channel: "sms" | "ussd"
    senderPhone: string
    command: string
    studentId?: string
    status: "ok" | "denied" | "invalid"
    requestId?: string
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        entityType: "HYBRID_MESSAGE",
        entityId: payload.studentId ?? payload.requestId ?? crypto.randomUUID(),
        action: payload.status.toUpperCase(),
        changes: JSON.stringify(payload),
      },
    })
  }
}
