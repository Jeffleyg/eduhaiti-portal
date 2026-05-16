import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { buildAuditData } from '../../common/audit-compat';

@Injectable()
export class HybridAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logMessageQuery(payload: {
    channel: 'sms' | 'ussd';
    senderPhone: string;
    command: string;
    studentId?: string;
    status: 'ok' | 'denied' | 'invalid';
    requestId?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: buildAuditData({
        entityType: 'HYBRID_MESSAGE',
        entityId: payload.studentId ?? payload.requestId ?? crypto.randomUUID(),
        action: payload.status.toUpperCase(),
        changes: payload,
      }),
    });
  }
}
