import { describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { createPrismaMock } from './test-utils/prisma-mock';
import { UssdMenuService } from './hybrid-gateway/services/ussd-menu.service';
import { OperatorAdapterRegistryService } from './hybrid-gateway/services/operator-adapter-registry.service';
import { DigicelAdapter } from './hybrid-gateway/adapters/digicel.adapter';
import { NatcomAdapter } from './hybrid-gateway/adapters/natcom.adapter';
import { FinanceObservabilityService } from './finance-integration/services/finance-observability.service';

describe('UssdMenuService', () => {
  const svc = new UssdMenuService();
  it.each([
    ['', false, 'Meni EduHaiti'],
    ['  ', false, 'Meni EduHaiti'],
    ['1', false, 'Tape: 1*'],
    ['1*S1', true, 'S1'],
    ['2', true, 'Kalandriye'],
    ['3', true, 'AVI'],
    ['4', false, 'Tape: 4*'],
    ['4*S1', true, 'S1'],
    ['9', true, 'Opsyon pa valid'],
  ])('handles %j', (input, end, text) => {
    const r = svc.handle(input);
    expect(r.endSession).toBe(end);
    expect(r.text).toContain(text);
  });
});

describe('OperatorAdapterRegistryService', () => {
  const registry = new OperatorAdapterRegistryService(new DigicelAdapter(), new NatcomAdapter());

  it('resolves known operators', () => {
    expect(registry.resolve('digicel')).toBeInstanceOf(DigicelAdapter);
    expect(registry.resolve('natcom')).toBeInstanceOf(NatcomAdapter);
  });

  it('falls back to a generic adapter', () => {
    const a = registry.resolve('other');
    expect(a.canHandle()).toBe(true);
    expect(a.normalizeSms({ phone: 5, body: 'b', sessionId: 's', requestId: 'r' })).toEqual({
      channel: 'sms',
      operator: 'unknown',
      senderPhone: '5',
      text: 'b',
      sessionId: 's',
      requestId: 'r',
    });
    expect(a.normalizeSms({ msisdn: 'm', text: 't' })).toMatchObject({
      sessionId: undefined,
      requestId: undefined,
    });
    expect(a.normalizeSms({ from: 'f', message: {} })).toMatchObject({
      senderPhone: 'f',
      text: '',
    });
    const withSession = a.normalizeUssd({ session: 's', from: 'f', input: '1', requestId: 'r' });
    expect(withSession).toMatchObject({ sessionId: 's', text: '1', requestId: 'r' });
    const generated = a.normalizeUssd({ msisdn: 'm', text: 't' });
    expect(generated.sessionId).toEqual(expect.any(String));
    expect(generated.sessionId.length).toBeGreaterThan(0);
    expect(a.normalizeUssd({ sessionId: 'x', phone: 'p' }).sessionId).toBe('x');
    expect(a.formatSmsResponse('x')).toEqual({ message: 'x' });
    expect(a.formatUssdResponse('y', true)).toEqual({ response: 'y', action: 'end' });
    expect(a.formatUssdResponse('y', false)).toEqual({ response: 'y', action: 'continue' });
  });
});

describe('FinanceObservabilityService', () => {
  const quiet = () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  };

  it('logs at each level without persisting by default', async () => {
    quiet();
    const prisma = createPrismaMock();
    const svc = new FinanceObservabilityService(prisma as any);
    await svc.logPaymentStage('REQUEST_RECEIVED', {});
    await svc.logPaymentStage('SIGNATURE_REJECTED', {}, { level: 'warn' });
    await svc.logPaymentStage('IDEMPOTENCY_FAILED', {}, { level: 'error' });
    expect(Logger.prototype.log).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('persists audit with the best available entity id', async () => {
    quiet();
    const prisma = createPrismaMock();
    const tx = createPrismaMock();
    const svc = new FinanceObservabilityService(prisma as any);
    await svc.logPaymentStage('REQUEST_RECEIVED', { idempotencyKey: 'k' }, { persistAudit: true });
    await svc.logPaymentStage('REQUEST_RECEIVED', { transferId: 't' }, { persistAudit: true });
    await svc.logPaymentStage('REQUEST_RECEIVED', { paymentId: 'p' }, { persistAudit: true, tx: tx as any });
    await svc.logPaymentStage('REQUEST_RECEIVED', { idempotencyKey: 5 }, { persistAudit: true });
    const ids = prisma.auditLog.create.mock.calls.map((c: any) => c[0].data.resourceId);
    expect(ids[0]).toBe('k');
    expect(ids[1]).toBe('t');
    expect(ids[2]).toEqual(expect.any(String));
    expect(tx.auditLog.create.mock.calls[0][0].data.resourceId).toBe('p');
    jest.restoreAllMocks();
  });

  it('swallows audit persistence errors', async () => {
    quiet();
    const prisma = createPrismaMock();
    prisma.auditLog.create.mockRejectedValue(new Error('db down'));
    const svc = new FinanceObservabilityService(prisma as any);
    await expect(
      svc.logPaymentStage('CREDIT_COMPLETED', {}, { persistAudit: true }),
    ).resolves.toBeUndefined();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('AUDIT_PERSIST_FAILED'),
    );
    jest.restoreAllMocks();
  });
});
