import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceObservabilityService } from './finance-observability.service';

type IdempotencyStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

interface IdempotencyRow {
  idempotencyKey: string;
  status: IdempotencyStatus;
  responsePayload: Prisma.JsonValue | null;
}

@Injectable()
export class IdempotencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly observability: FinanceObservabilityService,
  ) {}

  async executeWithIdempotency<T>(
    idempotencyKey: string,
    operation: string,
    handler: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    await this.observability.logPaymentStage('IDEMPOTENCY_CHECK_STARTED', {
      idempotencyKey,
      operation,
    });

    return this.prisma.$transaction(
      async (tx) => {
        const existing = await this.tryAcquire(tx, idempotencyKey, operation);

        if (existing) {
          if (existing.status === 'COMPLETED') {
            await this.observability.logPaymentStage(
              'IDEMPOTENCY_REPLAY_RETURNED',
              {
                idempotencyKey,
                operation,
              },
              { tx, persistAudit: true },
            );

            return this.deserializeCompletedResult<T>(existing.responsePayload);
          }

          await this.observability.logPaymentStage(
            'IDEMPOTENCY_CONFLICT',
            {
              idempotencyKey,
              operation,
            },
            { tx, level: 'warn', persistAudit: true },
          );

          throw new ConflictException(
            `Idempotent request already in progress for key ${idempotencyKey}`,
          );
        }

        await this.observability.logPaymentStage(
          'IDEMPOTENCY_ACQUIRED',
          {
            idempotencyKey,
            operation,
          },
          { tx, persistAudit: true },
        );

        try {
          const result = await handler(tx);

          await tx.$executeRaw`
            UPDATE "IdempotencyRecord"
            SET
              "status" = 'COMPLETED'::"IdempotencyStatus",
              "responsePayload" = ${this.serializeResult(result)}::jsonb,
              "errorMessage" = NULL,
              "updatedAt" = NOW()
            WHERE "idempotencyKey" = ${idempotencyKey}
          `;

          await this.observability.logPaymentStage(
            'IDEMPOTENCY_COMPLETED',
            {
              idempotencyKey,
              operation,
            },
            { tx, persistAudit: true },
          );

          return result;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Unknown processing failure';

          await tx.$executeRaw`
            UPDATE "IdempotencyRecord"
            SET
              "status" = 'FAILED'::"IdempotencyStatus",
              "errorMessage" = ${message.slice(0, 1024)},
              "updatedAt" = NOW()
            WHERE "idempotencyKey" = ${idempotencyKey}
          `;

          await this.observability.logPaymentStage(
            'IDEMPOTENCY_FAILED',
            {
              idempotencyKey,
              operation,
              error: message,
            },
            { tx, level: 'error', persistAudit: true },
          );

          throw error;
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  private async tryAcquire(
    tx: Prisma.TransactionClient,
    idempotencyKey: string,
    operation: string,
  ): Promise<IdempotencyRow | null> {
    const insertedRaw = await tx.$executeRaw`
      INSERT INTO "IdempotencyRecord"
      ("id", "idempotencyKey", "operation", "status", "createdAt", "updatedAt")
      VALUES
      (${crypto.randomUUID()}, ${idempotencyKey}, ${operation}, 'PENDING'::"IdempotencyStatus", NOW(), NOW())
      ON CONFLICT ("idempotencyKey") DO NOTHING
    `;

    const inserted = Number(insertedRaw) === 1;

    const rows = await tx.$queryRaw<IdempotencyRow[]>`
      SELECT
        "idempotencyKey",
        "status",
        "responsePayload"
      FROM "IdempotencyRecord"
      WHERE "idempotencyKey" = ${idempotencyKey}
      FOR UPDATE
    `;

    const current = rows[0] ?? null;

    if (!current) {
      return null;
    }

    if (!inserted && current.status === 'FAILED') {
      await tx.$executeRaw`
        UPDATE "IdempotencyRecord"
        SET
          "status" = 'PENDING'::"IdempotencyStatus",
          "errorMessage" = NULL,
          "updatedAt" = NOW()
        WHERE "idempotencyKey" = ${idempotencyKey}
          AND "status" = 'FAILED'::"IdempotencyStatus"
      `;

      return null;
    }

    if (!inserted && current.status === 'PENDING') {
      return current;
    }

    if (!inserted && current.status === 'COMPLETED') {
      return current;
    }

    return null;
  }

  private serializeResult<T>(result: T): Prisma.JsonObject {
    return JSON.parse(JSON.stringify(result)) as Prisma.JsonObject;
  }

  private deserializeCompletedResult<T>(payload: Prisma.JsonValue | null): T {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new ConflictException(
        'Completed idempotent record has invalid response payload',
      );
    }

    return payload as T;
  }
}
