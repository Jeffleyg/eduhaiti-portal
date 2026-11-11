import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { createHmac } from 'crypto';
import { createPrismaMock } from './test-utils/prisma-mock';
import { WebhookSignatureService } from './finance-integration/services/webhook-signature.service';
import { ScorecardsService } from './scorecards/scorecards.service';
import { ResourcesService } from './resources/resources.service';
import { NatcomAdapter } from './hybrid-gateway/adapters/natcom.adapter';
import { DigicelAdapter } from './hybrid-gateway/adapters/digicel.adapter';

describe('WebhookSignatureService', () => {
  const secret = 'top-secret';
  const payload: any = { transferId: 't1', amount: 10 };
  const make = (env: Record<string, string | undefined>) =>
    new WebhookSignatureService({ get: (k: string) => env[k] } as any);
  const sign = (ts: string) =>
    createHmac('sha256', secret).update(`${ts}.${JSON.stringify(payload)}`).digest();

  it('rejects when secret, signature or timestamp is missing', () => {
    const now = String(Math.floor(Date.now() / 1000));
    expect(make({}).verifyDiasporaSignature(payload, 'x', now)).toBe(false);
    const svc = make({ DIASPORA_WEBHOOK_SECRET: secret });
    expect(svc.verifyDiasporaSignature(payload, undefined, now)).toBe(false);
    expect(svc.verifyDiasporaSignature(payload, 'x', undefined)).toBe(false);
  });

  it('rejects invalid or skewed timestamps', () => {
    const svc = make({ DIASPORA_WEBHOOK_SECRET: secret });
    expect(svc.verifyDiasporaSignature(payload, 'x', 'abc')).toBe(false);
    const old = String(Math.floor(Date.now() / 1000) - 10_000);
    expect(svc.verifyDiasporaSignature(payload, sign(old).toString('hex'), old)).toBe(false);
  });

  it('accepts hex, prefixed and base64 signatures (seconds or ms timestamps)', () => {
    const svc = make({
      DIASPORA_WEBHOOK_SECRET: secret,
      DIASPORA_WEBHOOK_MAX_SKEW_SECONDS: '60',
    });
    const sec = String(Math.floor(Date.now() / 1000));
    const ms = String(Date.now());
    expect(svc.verifyDiasporaSignature(payload, sign(sec).toString('hex').toUpperCase(), sec)).toBe(true);
    expect(svc.verifyDiasporaSignature(payload, `sha256=${sign(sec).toString('hex')}`, sec)).toBe(true);
    expect(svc.verifyDiasporaSignature(payload, ` ${sign(ms).toString('base64')} `, ms)).toBe(true);
  });

  it('rejects wrong signatures of same and different length', () => {
    const svc = make({ DIASPORA_WEBHOOK_SECRET: secret });
    const sec = String(Math.floor(Date.now() / 1000));
    const wrong = 'a'.repeat(64);
    expect(svc.verifyDiasporaSignature(payload, wrong, sec)).toBe(false);
    expect(svc.verifyDiasporaSignature(payload, 'short', sec)).toBe(false);
    // value with "=" but nothing after it
    expect(svc.verifyDiasporaSignature(payload, 'sha256=', sec)).toBe(false);
  });
});

describe('ScorecardsService', () => {
  it('throws when missing', async () => {
    const prisma = createPrismaMock();
    prisma.scorecard.findUnique.mockResolvedValue(null);
    await expect(
      new ScorecardsService(prisma as any).verifyPublicScorecard('x'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('builds a verification hash for generated and draft scorecards', async () => {
    const prisma = createPrismaMock();
    const svc = new ScorecardsService(prisma as any);
    const base = {
      id: 'sc',
      studentId: 'st',
      academicYearId: 'y',
      semester: 1,
      averageScore: 8.5,
      passStatus: 'PASS',
      ranking: 1,
      observations: null,
      generatedAt: new Date('2026-01-01'),
      pdfPath: 'p.pdf',
      student: { id: 'st' },
      academicYear: { id: 'y' },
      series: { id: 'se' },
    };
    prisma.scorecard.findUnique.mockResolvedValue(base);
    const generated = await svc.verifyPublicScorecard('sc');
    expect(generated.valid).toBe(true);
    expect(generated.verificationHash).toMatch(/^[a-f0-9]{64}$/);
    // Server file paths are not exposed to the public verifier.
    expect(generated.scorecard).not.toHaveProperty('pdfPath');
    expect(prisma.scorecard.findUnique.mock.calls[0][0].include.student.select).toEqual({ name: true, enrollmentNumber: true });

    prisma.scorecard.findUnique.mockResolvedValue({
      ...base,
      averageScore: null,
      generatedAt: null,
    });
    const draft = await svc.verifyPublicScorecard('sc');
    expect(draft.valid).toBe(false);
    expect(draft.verificationHash).not.toBe(generated.verificationHash);
  });
});

describe('ResourcesService', () => {
  it('creates and deletes with audit logs', async () => {
    const prisma = createPrismaMock();
    const svc = new ResourcesService(prisma as any);
    prisma.resource.create.mockResolvedValue({ id: 'r1' });
    prisma.resource.delete.mockResolvedValue({
      id: 'r1',
      classId: 'c',
      title: 't',
      filePath: 'f',
      fileType: 'pdf',
    });

    await expect(svc.create('c', 't', undefined, 'f', 'pdf', 'u')).resolves.toEqual({ id: 'r1' });
    await expect(svc.delete('r1')).resolves.toMatchObject({ id: 'r1' });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      resource: 'RESOURCE',
      action: 'CREATE',
      userId: 'u',
    });
  });

  it('queries resources', async () => {
    const prisma = createPrismaMock();
    const svc = new ResourcesService(prisma as any);
    await svc.findByClass('c');
    await svc.findLibraryBySeries('se');
    await svc.findLibraryBySchool('s');
    await svc.findById('r');
    expect(prisma.resource.findMany.mock.calls.map((c: any) => c[0].where)).toEqual([
      { classId: 'c' },
      { class: { seriesId: 'se' } },
      { class: { academicYear: { schoolId: 's' } } },
    ]);
    expect(prisma.resource.findUnique.mock.calls[0][0].where).toEqual({ id: 'r' });
  });
});

describe('operator adapters', () => {
  it('NatcomAdapter normalizes payloads', () => {
    const a = new NatcomAdapter();
    expect(a.canHandle('NATCOM')).toBe(true);
    expect(a.canHandle()).toBe(false);
    expect(a.normalizeSms({ sender: '509', body: 'hi', session: 5, id: true })).toEqual({
      channel: 'sms',
      operator: 'natcom',
      senderPhone: '509',
      text: 'hi',
      sessionId: '5',
      requestId: 'true',
    });
    expect(a.normalizeSms({ msisdn: 1, text: {} })).toEqual({
      channel: 'sms',
      operator: 'natcom',
      senderPhone: '1',
      text: '',
      sessionId: undefined,
      requestId: undefined,
    });
    expect(a.normalizeUssd({ session: 's', sender: 'p', input: '1', id: 'r' })).toMatchObject({
      sessionId: 's',
      text: '1',
      requestId: 'r',
    });
    expect(a.normalizeUssd({ sessionId: 's2', msisdn: 'p', text: '2' })).toMatchObject({
      sessionId: 's2',
      senderPhone: 'p',
      text: '2',
      requestId: undefined,
    });
    expect(a.formatSmsResponse('x')).toEqual({ sms: 'x' });
    expect(a.formatUssdResponse('y', true)).toEqual({ ussdString: 'y', shouldClose: true });
  });

  it('DigicelAdapter normalizes payloads', () => {
    const a = new DigicelAdapter();
    expect(a.canHandle('Digicel')).toBe(true);
    expect(a.canHandle()).toBe(false);
    expect(
      a.normalizeSms({ msisdn: '509', text: 'hi', sessionId: 's', requestId: 7 }),
    ).toEqual({
      channel: 'sms',
      operator: 'digicel',
      senderPhone: '509',
      text: 'hi',
      sessionId: 's',
      requestId: '7',
    });
    expect(a.normalizeSms({ from: false, message: 'm' })).toMatchObject({
      senderPhone: 'false',
      text: 'm',
      sessionId: undefined,
      requestId: undefined,
    });
    expect(a.normalizeUssd({ sessionId: 's', msisdn: 'p', text: 't', requestId: 'r' })).toMatchObject({
      sessionId: 's',
      requestId: 'r',
    });
    expect(a.normalizeUssd({ session_id: 's2', phoneNumber: 'q' })).toMatchObject({
      sessionId: 's2',
      senderPhone: 'q',
      text: '',
      requestId: undefined,
    });
    expect(a.formatSmsResponse('x')).toEqual({ message: 'x' });
    expect(a.formatUssdResponse('y', true)).toEqual({ response: 'y', action: 'end' });
    expect(a.formatUssdResponse('y', false)).toEqual({ response: 'y', action: 'continue' });
  });
});

void jest;
