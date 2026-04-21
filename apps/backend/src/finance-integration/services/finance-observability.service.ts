import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type StageLevel = 'log' | 'warn' | 'error';

export type PaymentStage =
  | 'REQUEST_RECEIVED'
  | 'SIGNATURE_VALIDATED'
  | 'SIGNATURE_REJECTED'
  | 'IDEMPOTENCY_CHECK_STARTED'
  | 'IDEMPOTENCY_REPLAY_RETURNED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_ACQUIRED'
  | 'IDEMPOTENCY_COMPLETED'
  | 'IDEMPOTENCY_FAILED'
  | 'CREDIT_COMPLETED';

@Injectable()
export class FinanceObservabilityService {
  private readonly logger = new Logger(FinanceObservabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logPaymentStage(
    stage: PaymentStage,
    payload: Record<string, unknown>,
    options?: {
      level?: StageLevel;
      tx?: Prisma.TransactionClient;
      persistAudit?: boolean;
    },
  ): Promise<void> {
    const level = options?.level ?? 'log';
    const event = {
      ts: new Date().toISOString(),
      component: 'finance',
      stage,
      ...payload,
    };

    const line = JSON.stringify(event);
    if (level === 'warn') {
      this.logger.warn(line);
    } else if (level === 'error') {
      this.logger.error(line);
    } else {
      this.logger.log(line);
    }

    if (!options?.persistAudit) {
      return;
    }

    try {
      const db = options.tx ?? this.prisma;
      await db.auditLog.create({
        data: {
          entityType: 'PAYMENT_PIPELINE',
          entityId:
            this.stringOrEmpty(payload.idempotencyKey) ||
            this.stringOrEmpty(payload.transferId) ||
            this.stringOrEmpty(payload.paymentId) ||
            crypto.randomUUID(),
          action: stage,
          changes: line,
        },
      });
    } catch {
      this.logger.warn(
        JSON.stringify({
          ts: new Date().toISOString(),
          component: 'finance',
          stage: 'AUDIT_PERSIST_FAILED',
        }),
      );
    }
  }

  private stringOrEmpty(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }
}
