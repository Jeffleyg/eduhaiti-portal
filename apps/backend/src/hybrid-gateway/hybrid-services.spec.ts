import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { createHmac } from 'crypto';
import { HybridOtpService, MAX_OTP_ATTEMPTS } from './services/hybrid-otp.service';
import { HybridOutboundSmsService } from './services/hybrid-outbound-sms.service';
import { phonesMatch, SqlServerReadService } from './services/sql-server-read.service';

describe('HybridOtpService', () => {
  let prisma: PrismaMock;
  let sms: { sendSms: jest.Mock<(...a: any[]) => Promise<any>> };
  let svc: HybridOtpService;
  const entity = '50912345678:s1';
  const hmac = (code: string) =>
    createHmac('sha256', 'test-otp-secret').update(`${entity}:${code}`).digest('hex');

  beforeEach(() => {
    process.env.HYBRID_OTP_SECRET = 'test-otp-secret';
    prisma = createPrismaMock();
    prisma.auditLog.count.mockResolvedValue(0);
    sms = { sendSms: jest.fn<(...a: any[]) => Promise<any>>().mockResolvedValue({ delivered: true }) };
    svc = new HybridOtpService(prisma as any, sms as any);
  });
  afterEach(() => {
    delete process.env.HYBRID_OTP_SECRET;
  });

  const issueLog = (over: Record<string, unknown> = {}) => ({
    id: 'log1',
    changes: {
      phone: '50912345678',
      studentId: 's1',
      tokenHint: '123',
      otpHash: hmac('654321'),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      ...over,
    },
  });

  it('issues a 6-digit OTP, stores only its HMAC and sends it by SMS', async () => {
    const r = await svc.issueOtp({ phone: '+509 1234-5678', studentId: 's1', tokenHint: 'A-123', operatorHint: 'digicel' });
    expect(r.otpCode).toMatch(/^\d{6}$/);
    const data = prisma.auditLog.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ resource: 'HYBRID_OTP', resourceId: entity, action: 'ISSUE' });
    expect(data.changes).toMatchObject({ phone: '50912345678', tokenHint: '123', otpHash: hmac(r.otpCode) });
    expect(JSON.stringify(data.changes)).not.toContain(`"${r.otpCode}"`);
    expect(sms.sendSms).toHaveBeenCalledWith({
      to: '+509 1234-5678',
      text: expect.stringContaining(r.otpCode),
      operatorHint: 'digicel',
      context: { purpose: 'HYBRID_OTP', studentId: 's1' },
    });

    await svc.issueOtp({ phone: '509', studentId: 's1' });
    expect(prisma.auditLog.create.mock.calls[1][0].data.changes.tokenHint).toBeUndefined();
  });

  it('falls back to JWT_SECRET and then an empty key for the HMAC', async () => {
    const saved = process.env.JWT_SECRET;
    delete process.env.HYBRID_OTP_SECRET;
    process.env.JWT_SECRET = 'jwt';
    const r = await svc.issueOtp({ phone: '50912345678', studentId: 's1' });
    expect(prisma.auditLog.create.mock.calls[0][0].data.changes.otpHash).toBe(
      createHmac('sha256', 'jwt').update(`${entity}:${r.otpCode}`).digest('hex'),
    );
    delete process.env.JWT_SECRET;
    const r2 = await svc.issueOtp({ phone: '50912345678', studentId: 's1' });
    expect(prisma.auditLog.create.mock.calls[1][0].data.changes.otpHash).toBe(
      createHmac('sha256', '').update(`${entity}:${r2.otpCode}`).digest('hex'),
    );
    if (saved === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = saved;
  });

  it('counts codes issued recently for rate limiting', async () => {
    prisma.auditLog.count.mockResolvedValueOnce(2);
    await expect(svc.countRecentIssues('+509 1234-5678', 's1', 60_000)).resolves.toBe(2);
    const where = prisma.auditLog.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ entityType: 'HYBRID_OTP', entityId: entity, action: 'ISSUE' });
    expect(where.createdAt.gt).toBeInstanceOf(Date);
  });

  it('fails fast for missing, unknown and unreadable issues', async () => {
    expect(await svc.verifyOtp({ phone: 'p', studentId: 's' })).toEqual({ ok: false, reason: 'missing' });
    expect(await svc.verifyOtp({ phone: 'p', studentId: 's', otpCode: ' ' })).toEqual({ ok: false, reason: 'missing' });
    prisma.auditLog.findFirst.mockResolvedValueOnce(null);
    expect(await svc.verifyOtp({ phone: 'p', studentId: 's', otpCode: '1' })).toEqual({
      ok: false,
      reason: 'not-issued',
    });
    prisma.auditLog.findFirst.mockResolvedValueOnce({ id: 'l', changes: null });
    expect(await svc.verifyOtp({ phone: 'p', studentId: 's', otpCode: '1' })).toEqual({
      ok: false,
      reason: 'invalid-payload',
    });
  });

  it('expires old or malformed codes and logs it', async () => {
    prisma.auditLog.findFirst.mockResolvedValueOnce(issueLog({ expiresAt: new Date(0).toISOString() }));
    expect(await svc.verifyOtp({ phone: '50912345678', studentId: 's1', otpCode: '654321' })).toEqual({
      ok: false,
      reason: 'expired',
    });
    prisma.auditLog.findFirst.mockResolvedValueOnce(issueLog({ expiresAt: 'garbage' }));
    expect((await svc.verifyOtp({ phone: '50912345678', studentId: 's1', otpCode: '1' })).ok).toBe(false);
    expect(prisma.auditLog.create.mock.calls.map((c: any) => c[0].data.action)).toEqual([
      'VERIFY_EXPIRED',
      'VERIFY_EXPIRED',
    ]);
  });

  it('checks phone and token binding', async () => {
    prisma.auditLog.findFirst.mockResolvedValue(issueLog());
    expect(await svc.verifyOtp({ phone: '509 0000 0000', studentId: 's1', otpCode: '654321' })).toEqual({
      ok: false,
      reason: 'phone-mismatch',
    });
    expect(
      await svc.verifyOtp({ phone: '50912345678', studentId: 's1', otpCode: '654321', tokenHint: '999' }),
    ).toEqual({ ok: false, reason: 'token-mismatch' });
  });

  it('accepts the right code and rejects a wrong one', async () => {
    prisma.auditLog.findFirst.mockResolvedValue(issueLog());
    expect(
      await svc.verifyOtp({ phone: '50912345678', studentId: 's1', otpCode: ' 654321 ', tokenHint: '123' }),
    ).toEqual({ ok: true });
    expect(await svc.verifyOtp({ phone: '50912345678', studentId: 's1', otpCode: '000000' })).toEqual({
      ok: false,
      reason: 'wrong-code',
    });
    prisma.auditLog.findFirst.mockResolvedValue(issueLog({ tokenHint: undefined }));
    expect(
      await svc.verifyOtp({ phone: '50912345678', studentId: 's1', otpCode: '654321', tokenHint: '5' }),
    ).toEqual({ ok: true });
    expect(prisma.auditLog.create.mock.calls.map((c: any) => c[0].data.action)).toEqual([
      'VERIFY_OK',
      'VERIFY_FAIL',
      'VERIFY_OK',
    ]);
    expect(prisma.auditLog.count.mock.calls[0][0].where).toMatchObject({
      action: 'VERIFY_FAIL',
      changes: { path: ['issueLogId'], equals: 'log1' },
    });
  });

  it('rejects legacy plaintext issues and burns the code after too many failures', async () => {
    prisma.auditLog.findFirst.mockResolvedValue(issueLog({ otpHash: undefined, otpCode: '654321' }));
    expect(await svc.verifyOtp({ phone: '50912345678', studentId: 's1', otpCode: '654321' })).toEqual({
      ok: false,
      reason: 'wrong-code',
    });

    prisma.auditLog.findFirst.mockResolvedValue(issueLog());
    prisma.auditLog.count.mockResolvedValue(MAX_OTP_ATTEMPTS);
    expect(await svc.verifyOtp({ phone: '50912345678', studentId: 's1', otpCode: '654321' })).toEqual({
      ok: false,
      reason: 'too-many-attempts',
    });
  });
});

describe('HybridOutboundSmsService', () => {
  const fetchMock = jest.fn<(...a: any[]) => Promise<any>>();
  const realFetch = global.fetch;
  const envKeys = ['HYBRID_OUTBOUND_SMS_URL', 'HYBRID_OUTBOUND_SMS_API_KEY', 'HYBRID_OUTBOUND_SMS_TIMEOUT_MS'];
  let prisma: PrismaMock;
  let svc: HybridOutboundSmsService;

  beforeEach(() => {
    envKeys.forEach((k) => delete process.env[k]);
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma = createPrismaMock();
    svc = new HybridOutboundSmsService(prisma as any);
  });
  afterEach(() => {
    envKeys.forEach((k) => delete process.env[k]);
    (global as any).fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('ignores empty messages', async () => {
    expect(await svc.sendSms({ to: ' ', text: 'x' })).toEqual({ delivered: false, queued: false, operator: 'unknown' });
    expect(await svc.sendSms({ to: '1', text: ' ', operatorHint: ' natcom ' })).toEqual({
      delivered: false,
      queued: false,
      operator: 'natcom',
    });
  });

  it('queues when no gateway is configured', async () => {
    expect(await svc.sendSms({ to: '509', text: 'hi', context: { a: 1 } })).toEqual({
      delivered: false,
      queued: true,
      operator: 'unknown',
    });
    expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe('SMS_QUEUED');
    await svc.sendSms({ to: '509', text: 'hi' });
    expect(prisma.auditLog.create.mock.calls[1][0].data.changes.context).toBeNull();
  });

  it('delivers through the gateway with optional api key', async () => {
    process.env.HYBRID_OUTBOUND_SMS_URL = 'http://sms';
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    expect(await svc.sendSms({ to: '509', text: 'hi', operatorHint: 'digicel' })).toEqual({
      delivered: true,
      queued: false,
      operator: 'digicel',
    });
    expect((fetchMock.mock.calls[0][1] as any).headers.authorization).toBeUndefined();
    process.env.HYBRID_OUTBOUND_SMS_API_KEY = 'k';
    await svc.sendSms({ to: '509', text: 'hi', context: { c: 1 } });
    expect((fetchMock.mock.calls[1][1] as any).headers.authorization).toBe('Bearer k');
    expect(prisma.auditLog.create.mock.calls.map((c: any) => c[0].data.action)).toEqual(['SMS_SENT', 'SMS_SENT']);
  });

  it('records gateway rejections and network errors', async () => {
    process.env.HYBRID_OUTBOUND_SMS_URL = 'http://sms';
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    expect((await svc.sendSms({ to: '509', text: 'hi', context: { x: 1 } })).delivered).toBe(false);
    fetchMock.mockRejectedValueOnce('weird');
    expect((await svc.sendSms({ to: '509', text: 'hi' })).delivered).toBe(false);
    const reasons = prisma.auditLog.create.mock.calls.map((c: any) => c[0].data.changes.reason);
    expect(reasons).toEqual(['Outbound SMS rejected (500)', 'unknown_error']);
  });

  it('aborts slow gateways', async () => {
    jest.useFakeTimers();
    process.env.HYBRID_OUTBOUND_SMS_URL = 'http://sms';
    process.env.HYBRID_OUTBOUND_SMS_TIMEOUT_MS = '5';
    fetchMock.mockImplementationOnce(
      (_u: string, init: any) =>
        new Promise((_r, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))),
    );
    const p = svc.sendSms({ to: '509', text: 'hi' });
    await jest.advanceTimersByTimeAsync(10);
    expect((await p).delivered).toBe(false);
    jest.useRealTimers();
  });
});

describe('SqlServerReadService', () => {
  let prisma: PrismaMock;
  let svc: SqlServerReadService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SqlServerReadService(prisma as any);
  });

  it('exposes the optimized SQL', () => {
    expect(svc.buildOptimizedSqlServerQuery()).toContain('SELECT TOP 1');
  });

  describe('getCriticalSummary', () => {
    const linked = (...guardians: Array<{ phoneNumber: string; documentId?: string | null }>) => ({
      id: 's',
      guardianLinks: guardians.map((guardian) => ({ guardian: { documentId: null, ...guardian } })),
    });

    it('returns null for missing input or an unknown student', async () => {
      expect(await svc.getCriticalSummary('', '509')).toBeNull();
      expect(await svc.getCriticalSummary('s', '')).toBeNull();
      prisma.user.findUnique.mockResolvedValueOnce(null);
      expect(await svc.getCriticalSummary('s', '50912345678')).toBeNull();
      expect(prisma.user.findUnique.mock.calls[0][0].select.guardianLinks).toBeDefined();
    });

    it('denies callers who are not a guardian linked to the student', async () => {
      prisma.user.findUnique.mockResolvedValue(linked());
      expect(await svc.getCriticalSummary('s', '50912345678')).toBeNull(); // no guardian at all

      prisma.user.findUnique.mockResolvedValue(linked({ phoneNumber: '+509 3712-3456', documentId: '111' }));
      expect(await svc.getCriticalSummary('s', '50999999999')).toBeNull(); // someone else's phone
      expect(await svc.getCriticalSummary('s', '3456')).toBeNull(); // too short to match
      expect(await svc.getCriticalSummary('s', '50937123456', '999')).toBeNull(); // wrong document

      prisma.user.findUnique.mockResolvedValue(linked({ phoneNumber: '37123456', documentId: null }));
      expect(await svc.getCriticalSummary('s', '37123456', '111')).toBeNull(); // document sent but none on file
      expect(prisma.grade.aggregate).not.toHaveBeenCalled();
    });

    it('builds the summary for a linked guardian with school settings', async () => {
      prisma.user.findUnique.mockResolvedValue(
        linked({ phoneNumber: '11111111' }, { phoneNumber: '+509 3712-3456', documentId: 'ID-222' }),
      );
      prisma.grade.aggregate.mockResolvedValue({ _avg: { score: 12 } });
      prisma.attendance.count.mockResolvedValue(3);
      prisma.announcement.findFirst.mockResolvedValue({ title: 'News' });
      prisma.class.findFirst.mockResolvedValue({ academicYear: { schoolId: 'sc' } });
      prisma.academicSetting.findUnique.mockResolvedValue({ passAverage: 14 });
      expect(await svc.getCriticalSummary('s', '37123456', '222')).toEqual({
        studentId: 's',
        globalAverage: 12,
        absences: 3,
        passAverage: 14,
        approvalStatus: 'REPROVADO',
        latestAnnouncement: 'News',
      });
    });

    it('uses defaults when there is no class, settings or grades', async () => {
      prisma.user.findUnique.mockResolvedValue(linked({ phoneNumber: '50912345678' }));
      prisma.grade.aggregate.mockResolvedValue({ _avg: { score: null } });
      prisma.attendance.count.mockResolvedValue(0);
      prisma.announcement.findFirst.mockResolvedValue(null);
      prisma.class.findFirst.mockResolvedValue(null);
      expect(await svc.getCriticalSummary('s', '50912345678')).toMatchObject({
        globalAverage: 0,
        passAverage: 10,
        approvalStatus: 'REPROVADO',
        latestAnnouncement: undefined,
      });
      expect(prisma.academicSetting.findUnique).not.toHaveBeenCalled();

      prisma.grade.aggregate.mockResolvedValue({ _avg: { score: 15 } });
      prisma.class.findFirst.mockResolvedValue({ academicYear: { schoolId: 'sc' } });
      prisma.academicSetting.findUnique.mockResolvedValue(null);
      expect((await svc.getCriticalSummary('s', '50912345678'))?.approvalStatus).toBe('APROVADO');
    });
  });

  describe('phonesMatch', () => {
    it('ignores formatting and the country code but needs 8 digits', () => {
      expect(phonesMatch('+509 3712-3456', '37123456')).toBe(true);
      expect(phonesMatch('37123456', '50937123456')).toBe(true);
      expect(phonesMatch('37123456', '37123457')).toBe(false);
      expect(phonesMatch('3712345', '3712345')).toBe(false);
      expect(phonesMatch(null, undefined)).toBe(false);
    });
  });

  describe('getLatestLessonAudioSummary', () => {
    it('returns null without student, class or resource', async () => {
      expect(await svc.getLatestLessonAudioSummary('')).toBeNull();
      prisma.class.findFirst.mockResolvedValueOnce(null);
      expect(await svc.getLatestLessonAudioSummary('s')).toBeNull();
      prisma.class.findFirst.mockResolvedValueOnce({ id: 'c', name: '3e' });
      prisma.resource.findFirst.mockResolvedValueOnce(null);
      expect(await svc.getLatestLessonAudioSummary('s')).toBeNull();
    });

    it('flags audio resources', async () => {
      prisma.class.findFirst.mockResolvedValue({ id: 'c', name: '3e' });
      prisma.resource.findFirst.mockResolvedValueOnce({
        id: 'r',
        title: 't',
        description: null,
        fileType: 'MP3',
        filePath: 'a.mp3',
      });
      expect(await svc.getLatestLessonAudioSummary('s')).toMatchObject({ hasAudio: true, className: '3e' });
      prisma.resource.findFirst.mockResolvedValueOnce({
        id: 'r',
        title: 't',
        description: 'd',
        fileType: 'pdf',
        filePath: 'a.pdf',
      });
      expect((await svc.getLatestLessonAudioSummary('s'))?.hasAudio).toBe(false);
    });
  });
});
