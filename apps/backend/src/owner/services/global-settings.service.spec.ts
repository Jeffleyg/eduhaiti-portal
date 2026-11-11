import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { autoMock, AutoMock } from '../../test-utils/auto-mock';
import { GlobalSettingsService } from './global-settings.service';

describe('GlobalSettingsService', () => {
  let prisma: PrismaMock;
  let audit: AutoMock;
  let svc: GlobalSettingsService;
  const store = new Map<string, any>();
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    store.clear();
    prisma = createPrismaMock();
    audit = autoMock();
    prisma.globalSetting.findUnique.mockImplementation(async (a: any) => store.get(a.where.key) ?? null);
    prisma.globalSetting.create.mockImplementation(async (a: any) => {
      store.set(a.data.key, { ...a.data });
      return store.get(a.data.key);
    });
    prisma.globalSetting.update.mockImplementation(async (a: any) => {
      store.set(a.where.key, { ...store.get(a.where.key), ...a.data });
      return store.get(a.where.key);
    });
    prisma.globalSetting.findMany.mockImplementation(async () => [...store.values()]);
    prisma.globalSetting.count.mockImplementation(async () => store.size);
    svc = new GlobalSettingsService(prisma as any, audit as any);
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = originalKey;
  });

  describe('setSetting / getSetting', () => {
    it('requires a key', async () => {
      await expect(svc.setSetting('', 'v')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stores plain and object values and updates existing ones', async () => {
      await svc.setSetting('A', 'v1');
      await svc.setSetting('B', { x: 1 }, false, 'u', 'desc');
      await svc.setSetting('A', 'v2');
      expect(store.get('A').value).toBe('v2');
      expect(store.get('B').value).toBe('{"x":1}');
      expect(audit.log).not.toHaveBeenCalled();
      expect(await svc.getSetting('A')).toMatchObject({ value: 'v2' });
      expect(await svc.getSetting('missing')).toBeNull();
    });

    it('encrypts secrets with GCM, audits without values and masks them on read', async () => {
      await svc.setSetting('SECRET', 'p@ss:word', true, 'u');
      await svc.setSetting('SECRET2', 'x', true);
      expect(store.get('SECRET').value).not.toContain('p@ss');
      expect(store.get('SECRET').value).toMatch(/^v2:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
      expect(audit.log).toHaveBeenCalledTimes(1);
      expect(audit.log.mock.calls[0][0].newValues).toEqual({ isEncrypted: true });
      expect((await svc.getSetting('SECRET'))?.value).toBe('••••word');
      expect((await svc.getSetting('SECRET2'))?.value).toBe('••••');
      expect((await svc.getSetting('SECRET', { reveal: true }))?.value).toBe('p@ss:word');
    });

    it('detects tampered ciphertext', async () => {
      await svc.setSetting('SECRET', 'value', true);
      const [, iv, tag, data] = store.get('SECRET').value.split(':');
      const flipped = (parseInt(data.slice(0, 2), 16) ^ 1).toString(16).padStart(2, '0') + data.slice(2);
      store.get('SECRET').value = `v2:${iv}:${tag}:${flipped}`;
      await expect(svc.getSetting('SECRET', { reveal: true })).rejects.toThrow();
    });

    it('still reads values written with the legacy CBC format', async () => {
      process.env.ENCRYPTION_KEY = 'k'.repeat(32);
      const custom = new GlobalSettingsService(prisma as any, audit as any);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from('k'.repeat(32)), iv);
      const legacy = Buffer.concat([cipher.update('old-secret'), cipher.final()]);
      store.set('LEGACY', { key: 'LEGACY', isEncrypted: true, value: `${iv.toString('hex')}:${legacy.toString('hex')}` });
      expect((await custom.getSetting('LEGACY', { reveal: true }))?.value).toBe('old-secret');
    });

    it('uses ENCRYPTION_KEY from the environment, whatever its length', async () => {
      process.env.ENCRYPTION_KEY = 'short';
      const custom = new GlobalSettingsService(prisma as any, audit as any);
      await custom.setSetting('S', 'v', true);
      expect((await custom.getSetting('S', { reveal: true }))?.value).toBe('v');
      await expect(svc.getSetting('S', { reveal: true })).rejects.toThrow();
    });

    it('refuses to start in production without ENCRYPTION_KEY', () => {
      const env = process.env.NODE_ENV;
      delete process.env.ENCRYPTION_KEY;
      process.env.NODE_ENV = 'production';
      try {
        expect(() => new GlobalSettingsService(prisma as any, audit as any)).toThrow('ENCRYPTION_KEY must be set in production');
      } finally {
        process.env.NODE_ENV = env;
      }
    });

    it('rejects malformed encrypted payloads', () => {
      expect(() => (svc as any).decrypt('')).toThrow('Invalid encrypted payload');
      expect(() => (svc as any).decrypt('v2:abc')).toThrow('Invalid encrypted payload');
    });
  });

  it('returns raw settings and masks secrets in lists', async () => {
    await svc.setSetting('PUBLIC', 'v');
    await svc.setSetting('PRIVATE', 'secret', true);
    expect(await svc.getRawSetting('PRIVATE')).toMatchObject({ isEncrypted: true });
    const list = await svc.listSettings();
    expect(list).toMatchObject({ total: 2, skip: 0, take: 50 });
    expect(list.data.find((s: any) => s.key === 'PRIVATE')?.value).toBe('[ENCRYPTED]');
    expect(list.data.find((s: any) => s.key === 'PUBLIC')?.value).toBe('v');
    await svc.listSettings(1, 1);
  });

  describe('payment gateways', () => {
    it('requires provider and key', async () => {
      await expect(svc.setPaymentGatewayConfig('' as any, 'k')).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.setPaymentGatewayConfig('STRIPE', '')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stores key and optional secret and reads them back', async () => {
      expect(await svc.getPaymentGatewayConfig('STRIPE')).toEqual({
        provider: 'STRIPE',
        apiKey: undefined,
        apiSecret: undefined,
        configured: false,
      });
      await svc.setPaymentGatewayConfig('STRIPE', 'sk_test_123', 'sec', 'u');
      await svc.setPaymentGatewayConfig('MONCASH', 'c_123');
      expect(await svc.getPaymentGatewayConfig('STRIPE')).toEqual({
        provider: 'STRIPE',
        apiKey: '••••_123',
        apiSecret: '••••',
        configured: true,
      });
      expect(await svc.getPaymentGatewayConfig('STRIPE', { reveal: true })).toMatchObject({
        apiKey: 'sk_test_123',
        apiSecret: 'sec',
      });
      expect(store.has('GATEWAY_MONCASH_SECRET')).toBe(false);
    });

    it.each([
      ['STRIPE', 'short', 'Invalid API key'],
      ['STRIPE', 'pk_live_123456', 'Invalid Stripe'],
      ['ASAAS', '1234567890', 'Invalid Asaas'],
      ['EFI', '1234567890', 'Efí API key'],
      ['MONCASH', '1234567890', 'Invalid MonCash'],
    ])('rejects invalid %s key %s', async (provider, key, message) => {
      await expect(svc.validateGatewayConfig(provider as any, key)).rejects.toThrow(message);
    });

    it.each([
      ['STRIPE', 'sk_live_123456'],
      ['STRIPE', 'sk_test_123456'],
      ['ASAAS', 'a'.repeat(20)],
      ['EFI', 'client:secret!'],
      ['MONCASH', 'c_1234567890'],
      ['OTHER', '1234567890'],
    ])('accepts valid %s key', async (provider, key) => {
      await expect(svc.validateGatewayConfig(provider as any, key)).resolves.toEqual({ valid: true, provider });
    });
  });

  it('initializes defaults only once', async () => {
    const first = await svc.initializeDefaults();
    expect(first.created).toBe(15);
    expect((await svc.initializeDefaults()).created).toBe(0);
  });

  it('updates settings in bulk', async () => {
    const r = await svc.updateBulkSettings([{ key: 'A', value: '1' }, { key: 'B', value: 'x', encrypted: true }], 'u');
    expect(r.updated).toBe(2);
    expect(store.get('B').isEncrypted).toBe(true);
  });

  it('exposes only public settings in the system config', async () => {
    await svc.setSetting('JSON', '{"a":1}');
    await svc.setSetting('TEXT', 'hello');
    await svc.setSetting('SECRET', 's', true);
    expect(await svc.getSystemConfig()).toEqual({ JSON: { a: 1 }, TEXT: 'hello' });
  });
});
