import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { autoMock, AutoMock } from '../test-utils/auto-mock';
import { HybridGatewayService } from './hybrid-gateway.service';
import { CommandParserService } from './services/command-parser.service';
import { UssdMenuService } from './services/ussd-menu.service';
import { OperatorAdapterRegistryService } from './services/operator-adapter-registry.service';
import { DigicelAdapter } from './adapters/digicel.adapter';
import { NatcomAdapter } from './adapters/natcom.adapter';

const summary = {
  studentId: 'S1',
  globalAverage: 12.34,
  absences: 2,
  passAverage: 10,
  approvalStatus: 'APROVADO' as const,
  latestAnnouncement: 'Reunion',
};

describe('HybridGatewayService', () => {
  let sql: AutoMock;
  let audit: AutoMock;
  let otp: AutoMock;
  let svc: HybridGatewayService;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    sql = autoMock();
    audit = autoMock();
    otp = autoMock();
    otp.issueOtp.mockResolvedValue({ otpCode: '123456' });
    svc = new HybridGatewayService(
      new OperatorAdapterRegistryService(new DigicelAdapter(), new NatcomAdapter()),
      new CommandParserService(),
      sql as any,
      new UssdMenuService(),
      audit as any,
      otp as any,
    );
  });
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    delete process.env.HYBRID_DEBUG_OTP;
  });

  const sms = (text: string, extra: Record<string, unknown> = {}) =>
    svc.handleSms('digicel', { msisdn: '50912345678', text, requestId: 'r', ...extra });

  describe('handleSms', () => {
    it('rejects commands without student id', async () => {
      expect(await sms('NOT')).toEqual({ message: expect.stringContaining('Fòma') });
      expect(audit.logMessageQuery.mock.calls[0][0]).toMatchObject({ status: 'invalid' });
    });

    it('answers help', async () => {
      expect(await sms('ede')).toEqual({ message: expect.stringContaining('Kòmand') });
    });

    it('denies unauthorized callers', async () => {
      sql.getCriticalSummary.mockResolvedValue(null);
      expect(await sms('NOT S1 TOK')).toEqual({ message: expect.stringContaining('Pa otorize') });
      expect(audit.logMessageQuery.mock.calls[0][0]).toMatchObject({ status: 'denied', studentId: 'S1' });
    });

    it('challenges with OTP, echoing it only with the explicit debug flag outside production', async () => {
      sql.getCriticalSummary.mockResolvedValue(summary);
      otp.verifyOtp.mockResolvedValue({ ok: false });
      process.env.NODE_ENV = 'test';
      const noFlag: any = await sms('NOT S1 TOK');
      expect(noFlag.message).not.toContain('DEV');
      expect(otp.issueOtp).toHaveBeenCalledWith(expect.objectContaining({ operatorHint: 'digicel' }));

      process.env.HYBRID_DEBUG_OTP = 'true';
      const dev: any = await sms('NOT S1 TOK');
      expect(dev.message).toContain('[DEV OTP:123456]');
      process.env.NODE_ENV = 'production';
      const prod: any = await sms('NOT S1');
      expect(prod.message).not.toContain('DEV');
      expect(prod.message).toContain('NOTA S1  CODIGO_OTP');
    });

    it('answers NOTA, FREQ and AVISO once verified', async () => {
      sql.getCriticalSummary.mockResolvedValue(summary);
      otp.verifyOtp.mockResolvedValue({ ok: true });
      expect(await sms('NOT S1 T 1')).toEqual({ message: 'Mwayen:12.3 | Estati:PASE | Pou pase:10.0' });
      expect(await sms('PREZANS S1 T 1')).toEqual({ message: 'Absans:2 | Mwayen:12.3 | Estati:PASE' });
      expect(await sms('AVI S1 T 1')).toEqual({ message: 'Avi: Reunion' });

      sql.getCriticalSummary.mockResolvedValue({
        ...summary,
        approvalStatus: 'REPROVADO',
        latestAnnouncement: undefined,
      });
      expect(await sms('AVI S1 T 1')).toEqual({ message: 'Avi: Pa gen nouvo avi.' });
      expect(await sms('NOT S1 T 1')).toEqual({ message: expect.stringContaining('PA PASE') });
      expect(audit.logMessageQuery.mock.calls.every((c: any) => c[0].status === 'ok')).toBe(true);
    });

    it('truncates long responses to 160 chars', async () => {
      sql.getCriticalSummary.mockResolvedValue({ ...summary, latestAnnouncement: 'word '.repeat(60) });
      otp.verifyOtp.mockResolvedValue({ ok: true });
      const r: any = await sms('AVI S1 T 1');
      expect(r.message.length).toBeLessThanOrEqual(160);
      expect(r.message.endsWith('...')).toBe(true);
    });
  });

  describe('with160Chars', () => {
    const cut = (t: string) => (svc as any).with160Chars(t);
    it('keeps short text, normalizes whitespace, and cuts hard without spaces', () => {
      expect(cut('short')).toBe('short');
      expect(cut('a' + ' '.repeat(200) + 'b')).toBe('a b');
      const hard = cut('x'.repeat(300));
      expect(hard).toBe('x'.repeat(157) + '...');
    });
  });

  describe('handleUssd', () => {
    const ussd = (text: string, extra: Record<string, unknown> = {}) =>
      svc.handleUssd('natcom', { session: 'sess', sender: '50912345678', input: text, ...extra });

    it('asks for the student id', async () => {
      expect(await ussd('1')).toEqual({ ussdString: 'Tape: 1*ID_ELEV*TOKEN*OTP', shouldClose: false });
    });

    it('denies unauthorized callers', async () => {
      sql.getCriticalSummary.mockResolvedValue(null);
      expect(await ussd('1*S1')).toEqual({ ussdString: expect.stringContaining('Pa otorize'), shouldClose: true });
      expect(audit.logMessageQuery.mock.calls[0][0].requestId).toBe('sess');
    });

    it('challenges with OTP', async () => {
      sql.getCriticalSummary.mockResolvedValue(summary);
      otp.verifyOtp.mockResolvedValue({ ok: false });
      process.env.NODE_ENV = 'development';
      expect((await ussd('1*S1*TOK')).ussdString).not.toContain('DEV');
      process.env.HYBRID_DEBUG_OTP = 'true';
      const dev: any = await ussd('1*S1*TOK');
      expect(dev).toEqual({ ussdString: expect.stringContaining('[DEV:123456]'), shouldClose: false });
      process.env.NODE_ENV = 'production';
      const prod: any = await ussd('1*S1');
      expect(prod.ussdString).toBe('Nou voye OTP a. Tape: 1*S1*TOKEN*OTP');
    });

    it('returns the summary once verified', async () => {
      sql.getCriticalSummary.mockResolvedValue(summary);
      otp.verifyOtp.mockResolvedValue({ ok: true });
      expect(await ussd('1*S1*T*999', { id: 'req' })).toEqual({
        ussdString: 'Mwayen:12.3 | Estati:PASE | Pou pase:10.0',
        shouldClose: true,
      });
      expect(audit.logMessageQuery.mock.calls[0][0]).toMatchObject({ status: 'ok', requestId: 'req' });
    });

    it('falls back to the static menu', async () => {
      expect(await ussd('')).toEqual({ ussdString: expect.stringContaining('Meni'), shouldClose: false });
      expect(await ussd('2')).toEqual({ ussdString: expect.stringContaining('Kalandriye'), shouldClose: true });
      expect(audit.logMessageQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('IVR', () => {
    const params = { studentId: 'S1', senderPhone: '50912345678' };

    it('denies unauthorized callers', async () => {
      sql.getCriticalSummary.mockResolvedValue(null);
      expect(await svc.buildIvrSummary(params)).toMatchObject({ authorized: false });
      expect(await svc.buildIvrLessonSummary(params)).toMatchObject({ authorized: false });
    });

    it('builds the school summary speech', async () => {
      sql.getCriticalSummary.mockResolvedValue(summary);
      const r: any = await svc.buildIvrSummary(params);
      expect(r.authorized).toBe(true);
      expect(r.speechText).toContain('Dènye avi lekòl la: Reunion.');
      sql.getCriticalSummary.mockResolvedValue({ ...summary, latestAnnouncement: undefined });
      expect(((await svc.buildIvrSummary(params)) as any).speechText).toContain('Pa gen nouvo avi');
    });

    it('builds the lesson summary speech', async () => {
      sql.getCriticalSummary.mockResolvedValue(summary);
      sql.getLatestLessonAudioSummary.mockResolvedValueOnce(null);
      expect(await svc.buildIvrLessonSummary(params)).toMatchObject({
        authorized: true,
        speechText: expect.stringContaining('Pa gen rezime leson'),
      });

      const lesson = {
        studentId: 'S1',
        className: '3e',
        resourceId: 'r',
        title: 'Fractions',
        description: '  Intro  ',
        fileType: 'mp3',
        filePath: 'a.mp3',
        hasAudio: true,
      };
      sql.getLatestLessonAudioSummary.mockResolvedValueOnce(lesson);
      const withAudio: any = await svc.buildIvrLessonSummary(params);
      expect(withAudio.speechText).toBe('Rezime leson klas 3e. Tit: Fractions. Rezime: Intro');
      expect(withAudio.audioAlternative).toEqual({ filePath: 'a.mp3', fileType: 'mp3' });

      sql.getLatestLessonAudioSummary.mockResolvedValueOnce({
        ...lesson,
        className: null,
        description: null,
        hasAudio: false,
      });
      const noAudio: any = await svc.buildIvrLessonSummary(params);
      expect(noAudio.speechText).toContain('Pa gen deskripsyon.');
      expect(noAudio.speechText).toContain('Rezime leson klas .');
      expect(noAudio.audioAlternative).toBeNull();
    });
  });
});
