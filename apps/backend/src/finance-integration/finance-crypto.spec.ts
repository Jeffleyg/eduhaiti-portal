import { UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createPrismaMock } from '../test-utils/prisma-mock';
import { autoMock } from '../test-utils/auto-mock';

const fsMock = {
  mkdir: jest.fn<(...a: any[]) => Promise<unknown>>(),
  readFile: jest.fn<(...a: any[]) => Promise<unknown>>(),
  appendFile: jest.fn<(...a: any[]) => Promise<unknown>>(),
};
jest.mock('node:fs/promises', () => ({
  mkdir: (...a: any[]) => fsMock.mkdir(...a),
  readFile: (...a: any[]) => fsMock.readFile(...a),
  appendFile: (...a: any[]) => fsMock.appendFile(...a),
}));

import { DidAuthService } from './services/did-auth.service';
import { ImmutableLedgerService, LedgerRecord } from './services/immutable-ledger.service';
import { HealthService } from '../health/health.service';

const config = (env: Record<string, string | undefined>) => ({ get: (k: string) => env[k] }) as any;

describe('DidAuthService', () => {
  const make = (env: Record<string, string | undefined> = {}) => {
    const prisma = createPrismaMock();
    return { prisma, svc: new DidAuthService(prisma as any, config(env)) };
  };

  it('rejects unknown students', async () => {
    const { prisma, svc } = make();
    prisma.user.findFirst.mockResolvedValueOnce(null);
    await expect(svc.issueTrustToken('d', 'e')).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'u', enrollmentNumber: null });
    await expect(svc.issueTrustToken('d', 'e')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('issues and verifies tokens with every key format', async () => {
    const formats = [
      {},
      { DID_KEY_ENCRYPTION_KEY: 'a'.repeat(64), DID_TRUST_SIGNING_KEY: 'b'.repeat(64) },
      {
        DID_KEY_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
        DID_TRUST_SIGNING_KEY: Buffer.alloc(40, 2).toString('base64'),
      },
      { DID_KEY_ENCRYPTION_KEY: 'short', DID_TRUST_SIGNING_KEY: 'short' },
    ];
    for (const env of formats) {
      const { prisma, svc } = make(env);
      prisma.user.findFirst.mockResolvedValue({ id: 'u', enrollmentNumber: 'E1' });
      const { trustToken, expiresAt } = await svc.issueTrustToken('dev', 'E1');
      expect(expiresAt).toBeGreaterThan(Date.now());
      expect(svc.verifyTrustTokenOffline(trustToken)).toMatchObject({
        deviceId: 'dev',
        studentEnrollmentNumber: 'E1',
      });
      const audit = prisma.auditLog.create.mock.calls[0][0].data;
      expect(audit).toMatchObject({ resource: 'DID_KEY', action: 'STORE', resourceId: 'u' });
      // the stored key blob decrypts with the same encryption key
      const blob = (audit.changes as any).encryptedKeyBlob;
      expect((svc as any).decryptKeyMaterial(blob)).toHaveLength(32);
    }
  });

  it('refuses to start in production without DID keys', () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => make()).toThrow('DID_KEY_ENCRYPTION_KEY must be set in production');
      expect(() => make({ DID_KEY_ENCRYPTION_KEY: 'a'.repeat(64) })).toThrow(
        'DID_TRUST_SIGNING_KEY must be set in production',
      );
    } finally {
      process.env.NODE_ENV = env;
    }
  });

  it('rejects malformed, tampered and expired tokens', async () => {
    const { prisma, svc } = make();
    prisma.user.findFirst.mockResolvedValue({ id: 'u', enrollmentNumber: 'E1' });
    const { trustToken } = await svc.issueTrustToken('dev', 'E1');
    const [payload, sig] = trustToken.split('.');

    expect(() => svc.verifyTrustTokenOffline('nodot')).toThrow('Invalid trust token format');
    expect(() => svc.verifyTrustTokenOffline(`${payload}.`)).toThrow('format');
    expect(() => svc.verifyTrustTokenOffline(`${payload}.x`)).toThrow('signature');
    const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A');
    expect(() => svc.verifyTrustTokenOffline(`${payload}.${flipped}`)).toThrow('signature');

    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000 * 60 * 60 * 24 * 31);
    expect(() => svc.verifyTrustTokenOffline(trustToken)).toThrow('expired');
    now.mockRestore();
  });
});

describe('ImmutableLedgerService', () => {
  let store: string | null;
  beforeEach(() => {
    store = null;
    fsMock.mkdir.mockReset().mockResolvedValue(undefined);
    fsMock.appendFile.mockReset().mockImplementation(async (_p: any, line: any) => {
      store = (store ?? '') + line;
    });
    fsMock.readFile.mockReset().mockImplementation(async () => {
      if (store === null) throw Object.assign(new Error('nf'), { code: 'ENOENT' });
      return store;
    });
  });

  it('chains records starting from GENESIS and verifies them', async () => {
    const svc = new ImmutableLedgerService();
    const a = await svc.append('t1', 'mobile-money', { amount: 1 });
    const b = await svc.append('t2', 'tuition-charge', { amount: 2 });
    expect(a.previousHash).toBe('GENESIS');
    expect(b.previousHash).toBe(a.hash);
    const all = await svc.readAll();
    expect(all).toHaveLength(2);
    expect(svc.verifyChain(all)).toEqual({ valid: true, brokenAtIndex: null });
  });

  it('detects broken links and tampered payloads', async () => {
    const svc = new ImmutableLedgerService();
    await svc.append('t1', 'mobile-money', { amount: 1 });
    await svc.append('t2', 'mobile-money', { amount: 2 });
    const all = await svc.readAll();
    const tampered: LedgerRecord[] = [{ ...all[0], payload: { amount: 99 } }, all[1]];
    expect(svc.verifyChain(tampered)).toEqual({ valid: false, brokenAtIndex: 0 });
    const relinked: LedgerRecord[] = [all[0], { ...all[1], previousHash: 'x' }];
    expect(svc.verifyChain(relinked)).toEqual({ valid: false, brokenAtIndex: 1 });
  });

  it('handles empty/odd files and propagates unexpected read errors', async () => {
    const svc = new ImmutableLedgerService();
    expect(await svc.readAll()).toEqual([]);
    store = '\n';
    expect((await svc.append('t', 'did-key', {})).previousHash).toBe('GENESIS');
    store = '{"timestamp":"x"}\n';
    expect((await svc.append('t', 'did-key', {})).previousHash).toBe('GENESIS');
    store = 'not-json\n' + store;
    expect((await svc.readAll()).length).toBe(2);

    fsMock.readFile.mockRejectedValue(Object.assign(new Error('perm'), { code: 'EACCES' }));
    await expect(svc.readAll()).rejects.toThrow('perm');
    await expect(svc.append('t', 'did-key', {})).rejects.toThrow('perm');
  });

  it('builds a filtered transparency report', async () => {
    const svc = new ImmutableLedgerService();
    const clock = jest.spyOn(Date.prototype, 'toISOString');
    const stamps = ['2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'];
    for (const [i, ts] of stamps.entries()) {
      clock.mockReturnValueOnce(ts);
      await svc.append(`t${i}`, i === 2 ? 'diaspora-remittance' : 'mobile-money', { i });
    }
    clock.mockRestore();
    store += '{"timestamp":"invalid-date","category":"x"}\n';

    const full = await svc.buildFinancialTransparencyReport();
    expect(full.totalRecords).toBe(3);
    expect(full.byCategory).toEqual({ 'mobile-money': 2, 'diaspora-remittance': 1 });
    expect(full.records.map((r) => r.index)).toEqual([0, 1, 2]);

    const ranged = await svc.buildFinancialTransparencyReport({
      startDate: '2026-01-15',
      endDate: '2026-02-15',
    });
    expect(ranged.totalRecords).toBe(1);

    const limited = await svc.buildFinancialTransparencyReport({ limit: 2 });
    expect(limited.records.map((r) => r.index)).toEqual([1, 2]);
    const clamped = await svc.buildFinancialTransparencyReport({ limit: 0 });
    expect(clamped.records).toHaveLength(1);

    store = null;
    const empty = await svc.buildFinancialTransparencyReport();
    expect(empty.lastHash).toBe('GENESIS');
  });
});

describe('HealthService', () => {
  const fetchMock = jest.fn<(...a: any[]) => Promise<any>>();
  const realFetch = global.fetch;
  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });
  afterEach(() => {
    (global as any).fetch = realFetch;
  });

  const snapshot = {
    total: 3,
    failed: 1,
    success: 2,
    failureRate: 1 / 3,
    threshold: 0.2,
    critical: false,
    windowSeconds: 300,
  };

  it('reports ok when all dependencies respond', async () => {
    const prisma = createPrismaMock();
    const alerts = autoMock();
    alerts.getSnapshot.mockReturnValue(snapshot);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const svc = new HealthService(
      prisma as any,
      config({ MONCASH_HEALTHCHECK_URL: 'http://m', NATCASH_API_URL: 'http://n', HEALTH_PROVIDER_TIMEOUT_MS: 'x' }),
      alerts as any,
    );
    const r = await svc.check();
    expect(r.status).toBe('ok');
    expect(r.dependencies.providers.moncash).toMatchObject({ ok: true, endpoint: 'http://m' });
    expect(r.dependencies.providers.natcash).toMatchObject({ ok: true, endpoint: 'http://n' });
    expect(r.webhookFailures.failureRate).toBe(0.3333);
  });

  it('reports degraded on database and provider failures', async () => {
    const prisma = createPrismaMock();
    prisma.$queryRaw.mockRejectedValueOnce(new Error('db down'));
    const alerts = autoMock();
    alerts.getSnapshot.mockReturnValue(snapshot);
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    const svc = new HealthService(
      prisma as any,
      config({ MONCASH_API_URL: 'http://m', HEALTH_PROVIDER_TIMEOUT_MS: '100' }),
      alerts as any,
    );
    const r = await svc.check();
    expect(r.status).toBe('degraded');
    expect(r.dependencies.database).toMatchObject({ ok: false, reason: 'db down' });
    expect(r.dependencies.providers.moncash).toMatchObject({ ok: false, reason: 'HTTP 503' });
    expect(r.dependencies.providers.natcash).toMatchObject({
      ok: false,
      reason: 'Provider endpoint not configured',
    });
  });

  it('describes non-Error failures', async () => {
    const prisma = createPrismaMock();
    prisma.$queryRaw.mockRejectedValueOnce('boom');
    const alerts = autoMock();
    alerts.getSnapshot.mockReturnValue(snapshot);
    fetchMock.mockRejectedValueOnce('x').mockRejectedValueOnce(new Error('timeout'));
    const svc = new HealthService(
      prisma as any,
      config({ MONCASH_API_URL: 'http://m', NATCASH_API_URL: 'http://n' }),
      alerts as any,
    );
    const r = await svc.check();
    expect(r.dependencies.database.reason).toBe('Database connectivity failed');
    const reasons = [r.dependencies.providers.moncash.reason, r.dependencies.providers.natcash.reason];
    expect(reasons).toEqual(expect.arrayContaining(['Provider request failed', 'timeout']));
  });

  it('aborts slow provider checks', async () => {
    jest.useFakeTimers();
    const prisma = createPrismaMock();
    const alerts = autoMock();
    alerts.getSnapshot.mockReturnValue(snapshot);
    fetchMock.mockImplementation(
      (_u: string, init: any) =>
        new Promise((_r, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))),
    );
    const svc = new HealthService(
      prisma as any,
      config({ MONCASH_API_URL: 'http://m', HEALTH_PROVIDER_TIMEOUT_MS: '5' }),
      alerts as any,
    );
    const p = svc.check();
    await jest.advanceTimersByTimeAsync(10);
    const r = await p;
    expect(r.dependencies.providers.moncash.reason).toBe('aborted');
    jest.useRealTimers();
  });
});
