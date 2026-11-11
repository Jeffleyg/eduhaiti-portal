import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { autoMock, AutoMock, httpContext } from '../test-utils/auto-mock';
import { FAMILY_CODE_LIMIT, FAMILY_TOKEN_AUDIENCE, FamilyAuthService } from './family-auth.service';
import { FamilySessionGuard } from './family-session.guard';

const studentWith = (...phones: string[]) => ({
  id: 'st',
  guardianLinks: phones.map((phone, i) => ({
    guardian: { id: `g${i}`, fullName: `Guardian ${i}`, phoneNumber: phone },
  })),
});

describe('FamilyAuthService', () => {
  let prisma: PrismaMock;
  let otp: AutoMock;
  let jwt: JwtService;
  let svc: FamilyAuthService;

  beforeEach(() => {
    prisma = createPrismaMock();
    otp = autoMock();
    otp.countRecentIssues.mockResolvedValue(0);
    otp.verifyOtp.mockResolvedValue({ ok: true });
    jwt = new JwtService({ secret: 'family-test-secret' });
    svc = new FamilyAuthService(prisma as any, otp as any, jwt);
  });

  describe('requestCode', () => {
    it('sends the code to the registered guardian phone', async () => {
      prisma.user.findFirst.mockResolvedValue(studentWith('+50999999999', '+50937123456'));
      await expect(svc.requestCode(' E1 ', '3712-3456')).resolves.toEqual({ sent: true });
      expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({
        enrollmentNumber: 'E1',
        role: 'STUDENT',
        isActive: true,
      });
      expect(otp.issueOtp).toHaveBeenCalledWith({ phone: '+50937123456', studentId: 'st' });
    });

    it('answers the same way for unknown students or phones, without sending anything', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(svc.requestCode('nope', '37123456')).resolves.toEqual({ sent: true });
      prisma.user.findFirst.mockResolvedValueOnce(studentWith('+50999999999'));
      await expect(svc.requestCode('E1', '37123456')).resolves.toEqual({ sent: true });
      prisma.user.findFirst.mockResolvedValueOnce(studentWith());
      await expect(svc.requestCode('E1', '37123456')).resolves.toEqual({ sent: true });
      expect(otp.issueOtp).not.toHaveBeenCalled();
    });

    it('stops sending once the rate limit is reached', async () => {
      prisma.user.findFirst.mockResolvedValue(studentWith('37123456'));
      otp.countRecentIssues.mockResolvedValue(FAMILY_CODE_LIMIT);
      await expect(svc.requestCode('E1', '37123456')).resolves.toEqual({ sent: true });
      expect(otp.issueOtp).not.toHaveBeenCalled();
    });
  });

  describe('verifyCode', () => {
    it('returns a family session token for a valid code', async () => {
      prisma.user.findFirst.mockResolvedValue(studentWith('37123456'));
      const r = await svc.verifyCode('E1', '+509 3712 3456', '123456');
      expect(otp.verifyOtp).toHaveBeenCalledWith({ phone: '37123456', studentId: 'st', otpCode: '123456' });
      expect(r.guardianName).toBe('Guardian 0');

      const payload: any = jwt.decode(r.token);
      expect(payload).toMatchObject({ sub: 'family:g0', studentId: 'st', aud: FAMILY_TOKEN_AUDIENCE });
      await expect(svc.readSession(r.token)).resolves.toEqual({
        studentId: 'st',
        guardianId: 'g0',
        guardianName: 'Guardian 0',
        guardianPhone: '37123456',
      });
    });

    it('rejects wrong codes and unknown guardians', async () => {
      prisma.user.findFirst.mockResolvedValue(studentWith('37123456'));
      otp.verifyOtp.mockResolvedValueOnce({ ok: false, reason: 'wrong-code' });
      await expect(svc.verifyCode('E1', '37123456', '000000')).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(svc.verifyCode('E1', '38888888', '123456')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  it('rejects tokens that are not family sessions', async () => {
    const staffToken = await new JwtService({ secret: 'other-secret' }).signAsync({ sub: 'st' });
    await expect(svc.readSession(staffToken)).rejects.toBeInstanceOf(UnauthorizedException);
    const noAudience = await jwt.signAsync({ sub: 'st' });
    await expect(svc.readSession(noAudience)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('FamilySessionGuard', () => {
  it('requires a bearer family token and exposes the session', async () => {
    const auth = autoMock();
    auth.readSession.mockResolvedValue({ studentId: 'st' });
    const guard = new FamilySessionGuard(auth as any);

    const request: any = { headers: { authorization: 'Bearer tok ' } };
    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
    expect(auth.readSession).toHaveBeenCalledWith('tok');
    expect(request.family).toEqual({ studentId: 'st' });

    for (const headers of [{}, { authorization: 'Basic x' }, { authorization: 'Bearer ' }, undefined]) {
      await expect(guard.canActivate(httpContext({ headers } as any))).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });
});
