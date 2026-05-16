import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { buildAuditData } from '../../common/audit-compat';

type OutboundSmsPayload = {
  to: string;
  text: string;
  operatorHint?: string;
  context?: Record<string, unknown>;
};

@Injectable()
export class HybridOutboundSmsService {
  private readonly logger = new Logger(HybridOutboundSmsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendSms(payload: OutboundSmsPayload): Promise<{
    delivered: boolean;
    queued: boolean;
    operator: string;
  }> {
    const to = payload.to.trim();
    const text = payload.text.trim();
    const operator = (payload.operatorHint ?? '').trim() || 'unknown';

    if (!to || !text) {
      return { delivered: false, queued: false, operator };
    }

    const endpoint = process.env.HYBRID_OUTBOUND_SMS_URL;
    const apiKey = process.env.HYBRID_OUTBOUND_SMS_API_KEY;
    const timeoutMs = Number(
      process.env.HYBRID_OUTBOUND_SMS_TIMEOUT_MS ?? '4000',
    );

    if (!endpoint) {
      await this.persistAudit('SMS_QUEUED', to, {
        to,
        text,
        operator,
        context: payload.context ?? null,
        reason: 'missing HYBRID_OUTBOUND_SMS_URL',
      });
      return { delivered: false, queued: true, operator };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          to,
          text,
          operator,
          context: payload.context ?? null,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ServiceUnavailableException(`Outbound SMS rejected (${response.status})`);
      }

      await this.persistAudit('SMS_SENT', to, {
        to,
        operator,
        context: payload.context ?? null,
      });

      return { delivered: true, queued: false, operator };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown_error';
      this.logger.warn(
        JSON.stringify({
          component: 'hybrid-outbound-sms',
          action: 'SMS_FAILED',
          to,
          reason,
        }),
      );

      await this.persistAudit('SMS_FAILED', to, {
        to,
        text,
        operator,
        context: payload.context ?? null,
        reason,
      });

      return { delivered: false, queued: false, operator };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async persistAudit(
    action: 'SMS_QUEUED' | 'SMS_SENT' | 'SMS_FAILED',
    entityId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: buildAuditData({
        entityType: 'HYBRID_OUTBOUND_SMS',
        entityId,
        action,
        changes: {
          ts: new Date().toISOString(),
          ...payload,
        },
      }),
    });
  }
}