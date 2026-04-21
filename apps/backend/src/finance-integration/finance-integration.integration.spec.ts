import { BadGatewayException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { createHmac } from 'crypto';
import { FinanceIntegrationController } from './finance-integration.controller';
import { FinanceIntegrationService } from './finance-integration.service';
import { MonCashProvider } from './providers/moncash.provider';
import { NatCashProvider } from './providers/natcash.provider';
import { ExchangeRateService } from './services/exchange-rate.service';
import { FinanceObservabilityService } from './services/finance-observability.service';
import { IdempotencyService } from './services/idempotency.service';
import { WebhookAlertService } from './services/webhook-alert.service';
import { WebhookSignatureService } from './services/webhook-signature.service';

interface FakeIdempotencyRecord {
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  operation: string;
  responsePayload: Prisma.JsonObject | null;
  errorMessage: string | null;
}

class FakePrismaForIdempotency {
  private readonly records = new Map<string, FakeIdempotencyRecord>();

  async $transaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const tx = {
      $executeRaw: async (
        query: TemplateStringsArray,
        ...values: unknown[]
      ): Promise<number> => {
        await Promise.resolve();
        const sql = query.join(' ');

        if (sql.includes('INSERT INTO "IdempotencyRecord"')) {
          const idempotencyKey = values[1] as string;
          const operation = values[2] as string;
          if (this.records.has(idempotencyKey)) {
            return 0;
          }

          this.records.set(idempotencyKey, {
            status: 'PENDING',
            operation,
            responsePayload: null,
            errorMessage: null,
          });
          return 1;
        }

        if (sql.includes(`"status" = 'COMPLETED'`)) {
          const responsePayload = values[0] as Prisma.JsonObject;
          const idempotencyKey = values[1] as string;
          const current = this.records.get(idempotencyKey);
          if (!current) {
            return 0;
          }

          current.status = 'COMPLETED';
          current.responsePayload = responsePayload;
          current.errorMessage = null;
          return 1;
        }

        if (sql.includes(`"status" = 'FAILED'`)) {
          const errorMessage = values[0] as string;
          const idempotencyKey = values[1] as string;
          const current = this.records.get(idempotencyKey);
          if (!current) {
            return 0;
          }

          current.status = 'FAILED';
          current.errorMessage = errorMessage;
          return 1;
        }

        if (
          sql.includes(`"status" = 'PENDING'`) &&
          sql.includes(`AND "status" = 'FAILED'`)
        ) {
          const idempotencyKey = values[0] as string;
          const current = this.records.get(idempotencyKey);
          if (!current || current.status !== 'FAILED') {
            return 0;
          }

          current.status = 'PENDING';
          current.errorMessage = null;
          return 1;
        }

        return 0;
      },
      $queryRaw: async (
        query: TemplateStringsArray,
        ...values: unknown[]
      ): Promise<
        Array<{
          idempotencyKey: string;
          status: 'PENDING' | 'COMPLETED' | 'FAILED';
          responsePayload: Prisma.JsonValue | null;
        }>
      > => {
        await Promise.resolve();
        const sql = query.join(' ');
        if (!sql.includes('FROM "IdempotencyRecord"')) {
          return [];
        }

        const idempotencyKey = values[0] as string;
        const record = this.records.get(idempotencyKey);
        if (!record) {
          return [];
        }

        return [
          {
            idempotencyKey,
            status: record.status,
            responsePayload: record.responsePayload,
          },
        ];
      },
    } as unknown as Prisma.TransactionClient;

    return callback(tx);
  }
}

describe('Finance Integration Resilience Tests', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('Provider Timeout Simulation', () => {
    const timeoutFetch = jest.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        return await new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            return;
          }

          if (signal.aborted) {
            reject(new Error('aborted'));
            return;
          }

          signal.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        });
      },
    );

    it('should fail with BadGatewayException when MonCash times out', async () => {
      global.fetch = timeoutFetch as unknown as typeof fetch;
      const config = {
        get: jest.fn((key: string) => {
          if (key === 'MONCASH_API_URL') return 'https://mock.moncash/pay';
          if (key === 'MONCASH_API_KEY') return 'test-key';
          if (key === 'MONCASH_TIMEOUT_MS') return '5';
          return undefined;
        }),
      };

      const provider = new MonCashProvider(config as unknown as ConfigService);

      await expect(
        provider.processCharge({
          externalReference: 'ref-1',
          accountNumber: '50937000000',
          amountHtg: 1000,
          narration: 'test',
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('should fail with BadGatewayException when NatCash times out', async () => {
      global.fetch = timeoutFetch as unknown as typeof fetch;
      const config = {
        get: jest.fn((key: string) => {
          if (key === 'NATCASH_API_URL') return 'https://mock.natcash/pay';
          if (key === 'NATCASH_API_KEY') return 'test-key';
          if (key === 'NATCASH_TIMEOUT_MS') return '5';
          return undefined;
        }),
      };

      const provider = new NatCashProvider(config as unknown as ConfigService);

      await expect(
        provider.processCharge({
          externalReference: 'ref-1',
          accountNumber: '50937000000',
          amountHtg: 1000,
          narration: 'test',
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  describe('Malicious Webhook Validation', () => {
    let controller: FinanceIntegrationController;
    const observabilityLog = jest.fn();
    const webhookRecord = jest.fn<(ok: boolean, reason?: string) => void>();
    const processDiasporaRemittance = jest
      .fn<() => Promise<{ ok: boolean }>>()
      .mockResolvedValue({ ok: true });

    beforeEach(() => {
      observabilityLog.mockReset();
      webhookRecord.mockReset();
      processDiasporaRemittance.mockClear();
    });

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [FinanceIntegrationController],
        providers: [
          WebhookSignatureService,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string) => {
                if (key === 'DIASPORA_WEBHOOK_SECRET') {
                  return 'top-secret';
                }
                if (key === 'DIASPORA_WEBHOOK_MAX_SKEW_SECONDS') {
                  return '60';
                }
                return undefined;
              },
            },
          },
          {
            provide: FinanceIntegrationService,
            useValue: {
              processDiasporaRemittance,
              processMobileMoneyPayment: jest.fn(),
              issueDidTrustToken: jest.fn(),
              verifyDidTrustTokenOffline: jest.fn(),
            },
          },
          {
            provide: FinanceObservabilityService,
            useValue: {
              logPaymentStage: observabilityLog.mockImplementation(
                async () => {},
              ),
            },
          },
          {
            provide: WebhookAlertService,
            useValue: {
              recordAttempt: webhookRecord,
              getSnapshot: jest.fn(),
            },
          },
        ],
      }).compile();

      controller = module.get(FinanceIntegrationController);
    });

    it('should reject webhook with invalid HMAC signature', async () => {
      const nowTs = Math.floor(Date.now() / 1000).toString();
      const payload = {
        sourcePlatform: 'diaspora-x',
        transferId: 'tx-001',
        studentEnrollmentNumber: 'ENR-1',
        amount: 100,
        currency: 'USD' as const,
      };

      const response = await controller.handleDiasporaWebhook(
        payload,
        'invalid-signature',
        nowTs,
      );

      expect(response).toEqual({
        accepted: false,
        reason: 'Invalid signature',
      });
      expect(processDiasporaRemittance).not.toHaveBeenCalled();
    });

    it('should reject webhook replay attack with expired timestamp', async () => {
      const expiredTs = Math.floor(
        (Date.now() - 5 * 60 * 1000) / 1000,
      ).toString();
      const payload = {
        sourcePlatform: 'diaspora-x',
        transferId: 'tx-002',
        studentEnrollmentNumber: 'ENR-2',
        amount: 200,
        currency: 'USD' as const,
      };

      const signature = createHmac('sha256', 'top-secret')
        .update(`${expiredTs}.${JSON.stringify(payload)}`)
        .digest('hex');

      const response = await controller.handleDiasporaWebhook(
        payload,
        signature,
        expiredTs,
      );

      expect(response).toEqual({
        accepted: false,
        reason: 'Invalid signature',
      });
      expect(processDiasporaRemittance).not.toHaveBeenCalled();
    });
  });

  describe('Concurrent Idempotency (3 identical requests)', () => {
    it('should execute only one request and reject concurrent duplicates', async () => {
      const fakePrisma = new FakePrismaForIdempotency();
      const service = new IdempotencyService(
        fakePrisma as unknown as never,
        {
          logPaymentStage: jest.fn().mockImplementation(async () => {}),
        } as unknown as FinanceObservabilityService,
      );

      let handlerExecutions = 0;

      const work = () =>
        service.executeWithIdempotency(
          'transfer-123',
          'DIASPORA_REMITTANCE',
          async () => {
            handlerExecutions += 1;
            await new Promise((resolve) => setTimeout(resolve, 25));
            return { credited: true, amount: 300 };
          },
        );

      const settled = await Promise.allSettled([work(), work(), work()]);

      const fulfilled = settled.filter((item) => item.status === 'fulfilled');
      const rejected = settled.filter((item) => item.status === 'rejected');

      expect(handlerExecutions).toBe(1);
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(2);

      for (const item of rejected) {
        if (item.status === 'rejected') {
          expect(item.reason).toBeInstanceOf(ConflictException);
        }
      }
    });
  });

  describe('FX Fallback when external query fails', () => {
    it('should use ConfigService fallback rates when FX API fails', async () => {
      global.fetch = jest.fn(() => {
        return Promise.reject(new Error('fx provider timeout'));
      }) as unknown as typeof fetch;

      const config = {
        get: jest.fn((key: string) => {
          if (key === 'FX_RATE_API_URL') return 'https://mock.fx/rates';
          if (key === 'FX_RATE_TIMEOUT_MS') return '100';
          if (key === 'FX_USD_TO_HTG_RATE') return '150';
          if (key === 'FX_EUR_TO_HTG_RATE') return '160';
          if (key === 'FX_SPREAD_PERCENT') return '0.01';
          if (key === 'FX_PLATFORM_FEE_PERCENT') return '0.02';
          return undefined;
        }),
      };

      const exchange = new ExchangeRateService(
        config as unknown as ConfigService,
      );
      const fx = await exchange.convertToHtg(10, 'USD');

      expect(fx.fxRateToHtg).toBe(150);
      expect(fx.grossHtg).toBe(1500);
      expect(fx.spreadAmountHtg).toBe(15);
      expect(fx.platformFeeAmountHtg).toBe(30);
      expect(fx.netHtg).toBe(1455);
    });
  });
});
