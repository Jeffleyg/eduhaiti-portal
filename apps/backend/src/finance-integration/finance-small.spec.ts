import {
  BadGatewayException,
  ConflictException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createPrismaMock } from '../test-utils/prisma-mock';
import { autoMock } from '../test-utils/auto-mock';
import { ExchangeRateService } from './services/exchange-rate.service';
import { IdempotencyService } from './services/idempotency.service';
import { WebhookAlertService } from './services/webhook-alert.service';
import { MonCashProvider } from './providers/moncash.provider';
import { NatCashProvider } from './providers/natcash.provider';

const config = (env: Record<string, string | undefined>) => ({ get: (k: string) => env[k] }) as any;
const fetchMock = jest.fn<(...a: any[]) => Promise<any>>();
const realFetch = global.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  (global as any).fetch = fetchMock;
});
afterEach(() => {
  (global as any).fetch = realFetch;
  jest.restoreAllMocks();
});

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe('ExchangeRateService', () => {
  it('uses fallback rates without endpoint and computes fees', async () => {
    const svc = new ExchangeRateService(config({}));
    const usd = await svc.convertToHtg(100, 'USD');
    expect(usd).toEqual({
      sourceCurrency: 'USD',
      sourceAmount: 100,
      fxRateToHtg: 132,
      grossHtg: 13200,
      spreadPercent: 0.0125,
      platformFeePercent: 0.005,
      spreadAmountHtg: 165,
      platformFeeAmountHtg: 66,
      netHtg: 12969,
    });
    expect((await svc.convertToHtg(1, 'EUR')).fxRateToHtg).toBe(143.5);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads configured numbers and ignores invalid ones', async () => {
    const svc = new ExchangeRateService(
      config({ FX_USD_TO_HTG_RATE: '130', FX_SPREAD_PERCENT: 'abc', FX_EUR_TO_HTG_RATE: '150' }),
    );
    const r = await svc.convertToHtg(1, 'USD');
    expect(r.fxRateToHtg).toBe(130);
    expect(r.spreadPercent).toBe(0.0125);
    expect((await svc.convertToHtg(1, 'EUR')).fxRateToHtg).toBe(150);
  });

  it('reads rates from the API (direct, string, nested) with fallbacks', async () => {
    const svc = new ExchangeRateService(config({ FX_RATE_API_URL: 'http://fx', FX_RATE_TIMEOUT_MS: '50' }));
    fetchMock.mockResolvedValueOnce(okJson({ USD_TO_HTG: 131 }));
    expect((await svc.convertToHtg(1, 'USD')).fxRateToHtg).toBe(131);
    fetchMock.mockResolvedValueOnce(okJson({ USD_TO_HTG: '133.5' }));
    expect((await svc.convertToHtg(1, 'USD')).fxRateToHtg).toBe(133.5);
    fetchMock.mockResolvedValueOnce(okJson({ rates: { EUR_TO_HTG: 140 } }));
    expect((await svc.convertToHtg(1, 'EUR')).fxRateToHtg).toBe(140);
    fetchMock.mockResolvedValueOnce(okJson({ rates: { EUR_TO_HTG: 'x' } }));
    expect((await svc.convertToHtg(1, 'EUR')).fxRateToHtg).toBe(143.5);
    fetchMock.mockResolvedValueOnce(okJson({ rates: [1], USD_TO_HTG: Infinity }));
    expect((await svc.convertToHtg(1, 'USD')).fxRateToHtg).toBe(132);
    fetchMock.mockResolvedValueOnce(okJson({ USD_TO_HTG: null }));
    expect((await svc.convertToHtg(1, 'USD')).fxRateToHtg).toBe(132);
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    expect((await svc.convertToHtg(1, 'USD')).fxRateToHtg).toBe(132);
    fetchMock.mockRejectedValueOnce(new Error('network'));
    expect((await svc.convertToHtg(1, 'USD')).fxRateToHtg).toBe(132);
  });

  it('aborts slow requests', async () => {
    jest.useFakeTimers();
    const svc = new ExchangeRateService(config({ FX_RATE_API_URL: 'http://fx', FX_RATE_TIMEOUT_MS: '10' }));
    fetchMock.mockImplementationOnce(
      (_url: string, init: any) =>
        new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))),
    );
    const p = svc.convertToHtg(1, 'USD');
    jest.advanceTimersByTime(20);
    await expect(p).resolves.toMatchObject({ fxRateToHtg: 132 });
    jest.useRealTimers();
  });
});

describe('IdempotencyService', () => {
  const setup = () => {
    const prisma = createPrismaMock();
    const observability = autoMock();
    const svc = new IdempotencyService(prisma as any, observability as any);
    return { prisma, observability, svc };
  };
  const stages = (obs: any) => obs.logPaymentStage.mock.calls.map((c: any) => c[0]);

  it('runs the handler once when the key is new', async () => {
    const { prisma, observability, svc } = setup();
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.$queryRaw.mockResolvedValue([{ idempotencyKey: 'k', status: 'PENDING', responsePayload: null }]);
    const handler = jest.fn(async () => ({ ok: true }));
    await expect(svc.executeWithIdempotency('k', 'op', handler)).resolves.toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(stages(observability)).toEqual([
      'IDEMPOTENCY_CHECK_STARTED',
      'IDEMPOTENCY_ACQUIRED',
      'IDEMPOTENCY_COMPLETED',
    ]);
  });

  it('acquires when the row cannot be read back', async () => {
    const { prisma, svc } = setup();
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(svc.executeWithIdempotency('k', 'op', async () => 'r')).resolves.toBe('r');
  });

  it('replays completed results', async () => {
    const { prisma, observability, svc } = setup();
    prisma.$executeRaw.mockResolvedValue(0);
    prisma.$queryRaw.mockResolvedValue([{ status: 'COMPLETED', responsePayload: { id: 'p1' } }]);
    const handler = jest.fn(async () => ({}));
    await expect(svc.executeWithIdempotency('k', 'op', handler)).resolves.toEqual({ id: 'p1' });
    expect(handler).not.toHaveBeenCalled();
    expect(stages(observability)).toContain('IDEMPOTENCY_REPLAY_RETURNED');
  });

  it('rejects completed rows with invalid payloads', async () => {
    const { prisma, svc } = setup();
    prisma.$executeRaw.mockResolvedValue(0);
    for (const payload of [null, 'str', [1]]) {
      prisma.$queryRaw.mockResolvedValueOnce([{ status: 'COMPLETED', responsePayload: payload }]);
      await expect(svc.executeWithIdempotency('k', 'op', async () => 1)).rejects.toBeInstanceOf(
        ConflictException,
      );
    }
  });

  it('conflicts while another request is pending', async () => {
    const { prisma, observability, svc } = setup();
    prisma.$executeRaw.mockResolvedValue(0);
    prisma.$queryRaw.mockResolvedValue([{ status: 'PENDING', responsePayload: null }]);
    await expect(svc.executeWithIdempotency('k', 'op', async () => 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(stages(observability)).toContain('IDEMPOTENCY_CONFLICT');
  });

  it('retries previously failed keys', async () => {
    const { prisma, svc } = setup();
    prisma.$executeRaw.mockResolvedValue(0);
    prisma.$queryRaw.mockResolvedValue([{ status: 'FAILED', responsePayload: null }]);
    await expect(svc.executeWithIdempotency('k', 'op', async () => 'again')).resolves.toBe('again');
    // insert + reset FAILED->PENDING + mark COMPLETED
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it('treats unknown statuses of existing rows as acquirable', async () => {
    const { prisma, svc } = setup();
    prisma.$executeRaw.mockResolvedValue(0);
    prisma.$queryRaw.mockResolvedValue([{ status: 'OTHER', responsePayload: null }]);
    await expect(svc.executeWithIdempotency('k', 'op', async () => 'x')).resolves.toBe('x');
  });

  it('marks failures and rethrows', async () => {
    const { prisma, observability, svc } = setup();
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(
      svc.executeWithIdempotency('k', 'op', async () => {
        throw new Error('handler failed');
      }),
    ).rejects.toThrow('handler failed');
    const failed = observability.logPaymentStage.mock.calls.find((c: any) => c[0] === 'IDEMPOTENCY_FAILED');
    expect(failed?.[1]).toMatchObject({ error: 'handler failed' });

    await expect(
      svc.executeWithIdempotency('k', 'op', async () => {
        throw 'string failure';
      }),
    ).rejects.toBe('string failure');
    const last = observability.logPaymentStage.mock.calls.at(-1)!;
    expect(last[1]).toMatchObject({ error: 'Unknown processing failure' });
  });
});

describe('WebhookAlertService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('starts empty with defaults', () => {
    const snap = new WebhookAlertService(config({})).getSnapshot();
    expect(snap).toEqual({
      total: 0,
      failed: 0,
      success: 0,
      failureRate: 0,
      threshold: 0.2,
      minSamples: 10,
      windowSeconds: 300,
      critical: false,
    });
  });

  it('alerts when the failure rate exceeds the threshold', () => {
    const svc = new WebhookAlertService(
      config({ WEBHOOK_ALERT_MIN_SAMPLES: '2', WEBHOOK_FAILURE_RATE_THRESHOLD: 'nope' }),
    );
    svc.recordAttempt(true);
    expect(Logger.prototype.error).not.toHaveBeenCalled();
    svc.recordAttempt(false, 'bad');
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('WEBHOOK_FAILURE_RATE_HIGH'),
    );
    expect(svc.getSnapshot()).toMatchObject({ total: 2, failed: 1, success: 1, critical: true });
  });

  it('drops attempts outside the window', () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    const svc = new WebhookAlertService(config({ WEBHOOK_ALERT_WINDOW_SECONDS: '10' }));
    svc.recordAttempt(false);
    now.mockReturnValue(1_000_000 + 20_000);
    expect(svc.getSnapshot().total).toBe(0);
  });
});

describe.each([
  ['MonCash', MonCashProvider, 'MONCASH', 'MON', 0.009],
  ['NatCash', NatCashProvider, 'NATCASH', 'NAT', 0.0085],
])('%s provider', (label, Provider, envPrefix, refPrefix, defaultFee) => {
  const env = { [`${envPrefix}_API_URL`]: 'http://p', [`${envPrefix}_API_KEY`]: 'key' };
  const req = { externalReference: 'ref', accountNumber: '509', amountHtg: 1000, narration: 'n' };
  const make = (extra: Record<string, string> = {}) => new Provider(config({ ...env, ...extra }));

  it('requires configuration', async () => {
    await expect(new Provider(config({})).processCharge(req)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('maps a full response', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ approved: true, feeAmountHtg: 5.123, netAmountHtg: '994.877', providerTransactionId: 'tx' }),
    );
    await expect(make().processCharge(req)).resolves.toEqual({
      approved: true,
      providerName: label.toLowerCase(),
      providerTransactionId: 'tx',
      netAmountHtg: 994.88,
      feeAmountHtg: 5.12,
    });
    const [, init] = fetchMock.mock.calls[0] as any;
    expect(init.headers.authorization).toBe('Bearer key');
    expect(JSON.parse(init.body)).toMatchObject({ reference: 'ref', amountHtg: 1000 });
  });

  it('falls back to status strings, computed fees and generated ids', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ status: 'SUCCESS', fee: 'abc', id: '  ' }));
    const r = await make().processCharge(req);
    const fee = Number((1000 * defaultFee).toFixed(2));
    expect(r).toEqual({
      approved: true,
      providerName: label.toLowerCase(),
      providerTransactionId: `${refPrefix}-ref`,
      feeAmountHtg: fee,
      netAmountHtg: Number((1000 - fee).toFixed(2)),
    });

    fetchMock.mockResolvedValueOnce(okJson({ state: 'pending', providerFee: 2 }));
    const r2 = await make({ [`${envPrefix}_FEE_PERCENT`]: '0.01' }).processCharge(req);
    expect(r2.approved).toBe(false);
    expect(r2.feeAmountHtg).toBe(2);

    fetchMock.mockResolvedValueOnce(okJson({}));
    expect((await make().processCharge(req)).approved).toBe(false);
  });

  it('maps errors to BadGateway', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 402 });
    await expect(make().processCharge(req)).rejects.toThrow(`${label} rejected charge (402)`);
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(make().processCharge(req)).rejects.toThrow(`${label} provider unavailable`);
    fetchMock.mockRejectedValueOnce(new Error('x'));
    await expect(make().processCharge(req)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('aborts on timeout', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementationOnce(
      (_u: string, init: any) =>
        new Promise((_r, rej) => init.signal.addEventListener('abort', () => rej(new Error('abort')))),
    );
    const p = make({ [`${envPrefix}_TIMEOUT_MS`]: '5' }).processCharge(req);
    jest.advanceTimersByTime(10);
    await expect(p).rejects.toThrow(`${label} provider unavailable`);
    jest.useRealTimers();
  });
});
