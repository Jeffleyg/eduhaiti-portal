import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Role } from '@prisma/client';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';

const bcryptMock = {
  hash: jest.fn(async (v: string) => `hash:${v}`),
  compare: jest.fn(async (v: string, h: string) => h === `hash:${v}`),
};
jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    hash: (...a: any[]) => (bcryptMock.hash as any)(...a),
    compare: (...a: any[]) => (bcryptMock.compare as any)(...a),
  },
}));

import { AuthService } from './auth.service';

describe('AuthService', () => {
  let prisma: PrismaMock;
  let jwt: { signAsync: jest.Mock<(...a: any[]) => Promise<string>> };
  let env: Record<string, string | undefined>;
  let svc: AuthService;
  let email: { sendPasswordResetEmail: jest.Mock<(...a: any[]) => Promise<boolean>> };

  beforeEach(() => {
    prisma = createPrismaMock();
    jwt = { signAsync: jest.fn(async () => 'jwt') };
    env = {};
    email = { sendPasswordResetEmail: jest.fn(async () => false) };
    svc = new AuthService(
      prisma as any,
      jwt as any,
      { get: (k: string) => env[k] } as any,
      email as any,
    );
  });

  describe('requestCode', () => {
    it('creates unknown users and returns a dev code outside production', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({ id: 'new' });
      const r = await svc.requestCode(' New@X.Y ');
      expect(prisma.user.create.mock.calls[0][0].data).toEqual({
        email: 'new@x.y',
        role: Role.STUDENT,
      });
      expect(r.delivered).toBe(true);
      expect(r.devCode).toMatch(/^\d{6}$/);
      expect(prisma.loginCode.deleteMany).toHaveBeenCalled();
      expect(prisma.loginCode.create.mock.calls[0][0].data).toMatchObject({
        email: 'new@x.y',
        userId: 'new',
      });
    });

    it('hides the code in production and honours TTL', async () => {
      env.NODE_ENV = 'production';
      env.AUTH_CODE_TTL_MINUTES = '1';
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u' });
      const before = Date.now();
      const r = await svc.requestCode('a@b.c');
      expect(r).toEqual({ delivered: true });
      const exp: Date = prisma.loginCode.create.mock.calls[0][0].data.expiresAt;
      expect(exp.getTime() - before).toBeLessThanOrEqual(61_000);
    });
  });

  describe('verifyCode', () => {
    it('rejects missing or wrong codes and unavailable accounts', async () => {
      prisma.loginCode.findFirst.mockResolvedValueOnce(null);
      await expect(svc.verifyCode('a@b.c', '1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      prisma.loginCode.findFirst.mockResolvedValue({
        id: 'lc',
        codeHash: 'hash:123456',
      });
      await expect(svc.verifyCode('a@b.c', '000000')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(svc.verifyCode('a@b.c', '123456')).rejects.toThrow(
        'Account not available',
      );
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u',
        isActive: false,
      });
      await expect(svc.verifyCode('a@b.c', '123456')).rejects.toThrow(
        'Account not available',
      );
    });

    it('consumes the code and returns a token', async () => {
      prisma.loginCode.findFirst.mockResolvedValue({
        id: 'lc',
        codeHash: 'hash:123456',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u',
        email: 'a@b.c',
        role: Role.ADMIN,
        isActive: true,
        schoolId: 's',
      });
      await expect(svc.verifyCode(' A@B.C ', '123456')).resolves.toMatchObject({
        token: 'jwt',
        user: { id: 'u' },
      });
      expect(prisma.loginCode.update.mock.calls[0][0].where).toEqual({
        id: 'lc',
      });
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'u',
        email: 'a@b.c',
        role: Role.ADMIN,
        schoolId: 's',
      });
    });
  });

  describe('profile', () => {
    it('gets the profile', async () => {
      await svc.getProfile('u');
      expect(prisma.user.findUnique.mock.calls[0][0].where).toEqual({
        id: 'u',
      });
    });

    it('rejects unknown users on update', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(svc.updateProfile('u', {} as any)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('builds the full name from payload or existing values', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u',
        firstName: 'Old',
        lastName: 'Name',
      });
      await svc.updateProfile('u', {
        firstName: 'New',
        dateOfBirth: '2000-01-01',
      } as any);
      await svc.updateProfile('u', {} as any);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u',
        firstName: null,
        lastName: null,
      });
      await svc.updateProfile('u', {} as any);
      const data = prisma.user.update.mock.calls.map((c: any) => c[0].data);
      expect(data[0]).toMatchObject({
        name: 'New Name',
        dateOfBirth: new Date('2000-01-01'),
      });
      expect(data[1]).toMatchObject({
        name: 'Old Name',
        dateOfBirth: undefined,
      });
      expect(data[2].name).toBeNull();
    });
  });

  describe('login', () => {
    const user = {
      id: 'u',
      email: 'a@b.c',
      role: Role.TEACHER,
      name: 'A',
      isActive: true,
      passwordHash: 'hash:pw',
      mustChangePassword: false,
      tempPasswordExpiresAt: null,
      enrollmentNumber: 'E',
      profilePhoto: null,
      schoolId: 's',
    };
    const actions = () =>
      prisma.auditLog.create.mock.calls.map(
        (c: any) => c[0].data.changes.reason ?? c[0].data.action,
      );

    it('rejects unknown, inactive or passwordless users', async () => {
      for (const u of [
        null,
        { ...user, isActive: false },
        { ...user, passwordHash: null },
      ]) {
        prisma.user.findUnique.mockResolvedValueOnce(u);
        await expect(svc.login('a@b.c', 'pw')).rejects.toThrow(
          'Invalid credentials',
        );
      }
      expect(actions()).toEqual(
        Array(3).fill('invalid_credentials_or_inactive'),
      );
    });

    it('rejects expired temporary passwords and wrong passwords', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...user,
        tempPasswordExpiresAt: new Date(0),
      });
      await expect(svc.login('a@b.c', 'pw')).rejects.toThrow(
        'Temporary password expired',
      );
      prisma.user.findUnique.mockResolvedValueOnce(user);
      await expect(svc.login('a@b.c', 'bad')).rejects.toThrow(
        'Invalid credentials',
      );
      expect(actions()).toEqual([
        'temporary_password_expired',
        'invalid_credentials',
      ]);
    });

    it('locks the e-mail after 5 failures, resets the window and clears on success', async () => {
      const realNow = Date.now;
      let now = 1_000_000;
      Date.now = () => now;
      try {
        for (let i = 0; i < 4; i++) {
          prisma.user.findUnique.mockResolvedValueOnce(user);
          await expect(svc.login('a@b.c', 'bad')).rejects.toThrow(
            'Invalid credentials',
          );
        }
        // A success before the 5th failure clears the counter.
        prisma.user.findUnique.mockResolvedValueOnce(user);
        await svc.login('a@b.c', 'pw');
        for (let i = 0; i < 5; i++) {
          prisma.user.findUnique.mockResolvedValueOnce(i % 2 ? user : null);
          await expect(svc.login('A@b.c', 'bad')).rejects.toThrow(
            'Invalid credentials',
          );
        }
        await expect(svc.login('a@b.c', 'pw')).rejects.toBeInstanceOf(
          HttpException,
        );
        await expect(svc.login('a@b.c', 'pw')).rejects.toThrow(
          'Too many login attempts',
        );
        // Lock expires after 15 minutes; an old failure window restarts at 1.
        now += 16 * 60 * 1000;
        prisma.user.findUnique.mockResolvedValueOnce(user);
        await expect(svc.login('a@b.c', 'bad')).rejects.toThrow(
          'Invalid credentials',
        );
        prisma.user.findUnique.mockResolvedValueOnce(user);
        await expect(svc.login('a@b.c', 'pw')).resolves.toMatchObject({
          token: 'jwt',
        });
      } finally {
        Date.now = realNow;
      }
    });

    it('returns a token and logs success (valid temp password too)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...user,
        tempPasswordExpiresAt: new Date(Date.now() + 60_000),
      });
      const r = await svc.login(' A@B.C ', 'pw');
      expect(r.token).toBe('jwt');
      expect(r.user).not.toHaveProperty('passwordHash');
      expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe(
        'LOGIN_SUCCESS',
      );
    });

    it('does not block login when audit logging fails', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('db'));
      prisma.user.findUnique.mockResolvedValueOnce(user);
      await expect(svc.login('a@b.c', 'pw')).resolves.toMatchObject({
        token: 'jwt',
      });
    });
  });

  it('logs out with user, email or unknown ids', async () => {
    await svc.logout('u', 'a@b.c');
    await svc.logout('', 'a@b.c');
    await svc.logout('');
    const data = prisma.auditLog.create.mock.calls.map((c: any) => c[0].data);
    expect(data.map((d: any) => d.entityId)).toEqual(['u', 'a@b.c', 'unknown']);
    expect(data[1].userId).toBeUndefined();
    expect(data[2].changes.email).toBeNull();
  });

  describe('changePassword', () => {
    it('validates the current password', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(svc.changePassword('u', 'a', 'b')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u',
        passwordHash: null,
      });
      await expect(svc.changePassword('u', 'a', 'b')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u',
        passwordHash: 'hash:x',
      });
      await expect(svc.changePassword('u', 'a', 'b')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('updates the password and clears the temp flag', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u',
        passwordHash: 'hash:old',
      });
      await expect(svc.changePassword('u', 'old', 'new')).resolves.toEqual({
        success: true,
      });
      expect(prisma.user.update.mock.calls[0][0].data).toEqual({
        passwordHash: 'hash:new',
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
      });
    });
  });

  describe('signup', () => {
    it('rejects duplicates and creates users', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'x' });
      await expect(
        svc.signup('a@b.c', 'A', Role.STUDENT),
      ).rejects.toBeInstanceOf(ConflictException);
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await svc.signup(' A@B.C ', 'A', Role.STUDENT);
      expect(prisma.user.create.mock.calls[0][0].data).toEqual({
        email: 'a@b.c',
        name: 'A',
        role: Role.STUDENT,
      });
    });
  });

  describe('password reset', () => {
    const TOKEN = 'a'.repeat(64);
    const future = () => new Date(Date.now() + 60_000);

    it('answers the same way for unknown or inactive accounts', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(svc.forgotPassword('no@x.y')).resolves.toEqual({ success: true });
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u', email: 'a@b.c', isActive: false });
      await expect(svc.forgotPassword('a@b.c')).resolves.toEqual({ success: true });
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(email.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('does not issue a second link within a minute', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u', email: 'a@b.c', isActive: true });
      prisma.passwordResetToken.findFirst.mockResolvedValueOnce({ id: 't' });
      await expect(svc.forgotPassword('a@b.c')).resolves.toEqual({ success: true });
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('stores only a hash, e-mails the link and returns it in development when not delivered', async () => {
      env.FRONTEND_URL = 'https://app.ht/';
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u', email: 'a@b.c', isActive: true });
      const r = await svc.forgotPassword(' A@B.C ');
      expect(prisma.user.findUnique.mock.calls[0][0]).toMatchObject({ where: { email: 'a@b.c' } });
      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u', usedAt: null } });
      const { data } = prisma.passwordResetToken.create.mock.calls[0][0];
      const token = /token=([0-9a-f]{64})$/.exec(r.devResetUrl!)![1];
      expect(r.devResetUrl).toBe(`https://app.ht/reset-password?token=${token}`);
      expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(data.tokenHash).not.toBe(token);
      expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 60_000);
      expect(email.sendPasswordResetEmail).toHaveBeenCalledWith('a@b.c', r.devResetUrl, data.expiresAt);
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('never returns the link once delivered or in production', async () => {
      env.CORS_ORIGIN = 'https://a.ht, https://b.ht';
      email.sendPasswordResetEmail.mockResolvedValueOnce(true);
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u', email: 'a@b.c', isActive: true });
      await expect(svc.forgotPassword('a@b.c')).resolves.toEqual({ success: true });
      expect(email.sendPasswordResetEmail.mock.calls[0][1]).toMatch(/^https:\/\/a\.ht\/reset-password\?token=/);

      env.NODE_ENV = 'production';
      env.CORS_ORIGIN = undefined;
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u', email: 'a@b.c', isActive: true });
      await expect(svc.forgotPassword('a@b.c')).resolves.toEqual({ success: true });
      expect(email.sendPasswordResetEmail.mock.calls[1][1]).toMatch(/^http:\/\/localhost:5173\/reset-password/);
    });

    it('reports whether a link is still usable', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValueOnce(null);
      await expect(svc.checkResetToken(TOKEN)).resolves.toEqual({ valid: false });
      for (const record of [
        { usedAt: new Date(), expiresAt: future(), user: { email: 'a@b.c', isActive: true } },
        { usedAt: null, expiresAt: new Date(Date.now() - 1), user: { email: 'a@b.c', isActive: true } },
        { usedAt: null, expiresAt: future(), user: { email: 'a@b.c', isActive: false } },
      ]) {
        prisma.passwordResetToken.findUnique.mockResolvedValueOnce({ id: 't', userId: 'u', ...record });
        await expect(svc.checkResetToken(TOKEN)).resolves.toEqual({ valid: false });
      }
      prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
        id: 't', userId: 'u', usedAt: null, expiresAt: future(), user: { email: 'a@b.c', isActive: true },
      });
      await expect(svc.checkResetToken(TOKEN)).resolves.toEqual({ valid: true });
    });

    it('rejects unusable or already claimed links', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValueOnce(null);
      await expect(svc.resetPassword(TOKEN, 'NewPass@1')).rejects.toBeInstanceOf(BadRequestException);
      prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
        id: 't', userId: 'u', usedAt: null, expiresAt: future(), user: { email: 'a@b.c', isActive: true },
      });
      prisma.passwordResetToken.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(svc.resetPassword(TOKEN, 'NewPass@1')).rejects.toThrow('Invalid or expired reset link');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('sets the new password, burns the link and lifts a login lock', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      for (let i = 0; i < 5; i++) {
        await svc.login('a@b.c', 'bad').catch(() => undefined);
      }
      await expect(svc.login('a@b.c', 'bad')).rejects.toBeInstanceOf(HttpException);

      prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
        id: 't', userId: 'u', usedAt: null, expiresAt: future(), user: { email: 'a@b.c', isActive: true },
      });
      prisma.passwordResetToken.updateMany.mockResolvedValueOnce({ count: 1 });
      await expect(svc.resetPassword(TOKEN, 'NewPass@1')).resolves.toEqual({ success: true });
      expect(prisma.passwordResetToken.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 't', usedAt: null } });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u' },
        data: { passwordHash: 'hash:NewPass@1', mustChangePassword: false, tempPasswordExpiresAt: null },
      });
      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u', usedAt: null } });
      // The lock is gone: the next attempt reaches the credential check again.
      await expect(svc.login('a@b.c', 'bad')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('getTestCredentials', () => {
    it('is hidden in production', () => {
      env.NODE_ENV = 'production';
      expect(() => svc.getTestCredentials()).toThrow(NotFoundException);
    });

    it('returns defaults or configured passwords', () => {
      expect(svc.getTestCredentials().admin.password).toBe('Password@123');
      env.DEFAULT_SEED_PASSWORD = 'seed';
      expect(svc.getTestCredentials().owner.password).toBe('seed');
      env.ADMIN_PASSWORD = 'a';
      env.TEACHER_PASSWORD = 't';
      env.STUDENT_PASSWORD = 's';
      env.OWNER_PASSWORD = 'o';
      const c = svc.getTestCredentials();
      expect([
        c.admin.password,
        c.teacher.password,
        c.student.password,
        c.owner.password,
      ]).toEqual(['a', 't', 's', 'o']);
    });
  });
});
