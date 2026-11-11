import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
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

  beforeEach(() => {
    prisma = createPrismaMock();
    jwt = { signAsync: jest.fn(async () => 'jwt') };
    env = {};
    svc = new AuthService(prisma as any, jwt as any, { get: (k: string) => env[k] } as any);
  });

  describe('requestCode', () => {
    it('creates unknown users and returns a dev code outside production', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({ id: 'new' });
      const r = await svc.requestCode(' New@X.Y ');
      expect(prisma.user.create.mock.calls[0][0].data).toEqual({ email: 'new@x.y', role: Role.STUDENT });
      expect(r.delivered).toBe(true);
      expect(r.devCode).toMatch(/^\d{6}$/);
      expect(prisma.loginCode.deleteMany).toHaveBeenCalled();
      expect(prisma.loginCode.create.mock.calls[0][0].data).toMatchObject({ email: 'new@x.y', userId: 'new' });
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
      await expect(svc.verifyCode('a@b.c', '1')).rejects.toBeInstanceOf(UnauthorizedException);

      prisma.loginCode.findFirst.mockResolvedValue({ id: 'lc', codeHash: 'hash:123456' });
      await expect(svc.verifyCode('a@b.c', '000000')).rejects.toBeInstanceOf(UnauthorizedException);

      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(svc.verifyCode('a@b.c', '123456')).rejects.toThrow('Account not available');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u', isActive: false });
      await expect(svc.verifyCode('a@b.c', '123456')).rejects.toThrow('Account not available');
    });

    it('consumes the code and returns a token', async () => {
      prisma.loginCode.findFirst.mockResolvedValue({ id: 'lc', codeHash: 'hash:123456' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u', email: 'a@b.c', role: Role.ADMIN, isActive: true, schoolId: 's' });
      await expect(svc.verifyCode(' A@B.C ', '123456')).resolves.toMatchObject({ token: 'jwt', user: { id: 'u' } });
      expect(prisma.loginCode.update.mock.calls[0][0].where).toEqual({ id: 'lc' });
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u', email: 'a@b.c', role: Role.ADMIN, schoolId: 's' });
    });
  });

  describe('profile', () => {
    it('gets the profile', async () => {
      await svc.getProfile('u');
      expect(prisma.user.findUnique.mock.calls[0][0].where).toEqual({ id: 'u' });
    });

    it('rejects unknown users on update', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(svc.updateProfile('u', {} as any)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('builds the full name from payload or existing values', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u', firstName: 'Old', lastName: 'Name' });
      await svc.updateProfile('u', { firstName: 'New', dateOfBirth: '2000-01-01' } as any);
      await svc.updateProfile('u', {} as any);
      prisma.user.findUnique.mockResolvedValue({ id: 'u', firstName: null, lastName: null });
      await svc.updateProfile('u', {} as any);
      const data = prisma.user.update.mock.calls.map((c: any) => c[0].data);
      expect(data[0]).toMatchObject({ name: 'New Name', dateOfBirth: new Date('2000-01-01') });
      expect(data[1]).toMatchObject({ name: 'Old Name', dateOfBirth: undefined });
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
    const actions = () => prisma.auditLog.create.mock.calls.map((c: any) => c[0].data.changes.reason ?? c[0].data.action);

    it('rejects unknown, inactive or passwordless users', async () => {
      for (const u of [null, { ...user, isActive: false }, { ...user, passwordHash: null }]) {
        prisma.user.findUnique.mockResolvedValueOnce(u);
        await expect(svc.login('a@b.c', 'pw')).rejects.toThrow('Invalid credentials');
      }
      expect(actions()).toEqual(Array(3).fill('invalid_credentials_or_inactive'));
    });

    it('rejects expired temporary passwords and wrong passwords', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...user, tempPasswordExpiresAt: new Date(0) });
      await expect(svc.login('a@b.c', 'pw')).rejects.toThrow('Temporary password expired');
      prisma.user.findUnique.mockResolvedValueOnce(user);
      await expect(svc.login('a@b.c', 'bad')).rejects.toThrow('Invalid credentials');
      expect(actions()).toEqual(['temporary_password_expired', 'invalid_credentials']);
    });

    it('returns a token and logs success (valid temp password too)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...user, tempPasswordExpiresAt: new Date(Date.now() + 60_000) });
      const r = await svc.login(' A@B.C ', 'pw');
      expect(r.token).toBe('jwt');
      expect(r.user).not.toHaveProperty('passwordHash');
      expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe('LOGIN_SUCCESS');
    });

    it('does not block login when audit logging fails', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('db'));
      prisma.user.findUnique.mockResolvedValueOnce(user);
      await expect(svc.login('a@b.c', 'pw')).resolves.toMatchObject({ token: 'jwt' });
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
      await expect(svc.changePassword('u', 'a', 'b')).rejects.toBeInstanceOf(UnauthorizedException);
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u', passwordHash: null });
      await expect(svc.changePassword('u', 'a', 'b')).rejects.toBeInstanceOf(UnauthorizedException);
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u', passwordHash: 'hash:x' });
      await expect(svc.changePassword('u', 'a', 'b')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('updates the password and clears the temp flag', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u', passwordHash: 'hash:old' });
      await expect(svc.changePassword('u', 'old', 'new')).resolves.toEqual({ success: true });
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
      await expect(svc.signup('a@b.c', 'A', Role.STUDENT)).rejects.toBeInstanceOf(ConflictException);
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await svc.signup(' A@B.C ', 'A', Role.STUDENT);
      expect(prisma.user.create.mock.calls[0][0].data).toEqual({ email: 'a@b.c', name: 'A', role: Role.STUDENT });
    });
  });

  describe('getTestCredentials', () => {
    it('is hidden in production', () => {
      env.NODE_ENV = 'production';
      expect(() => svc.getTestCredentials()).toThrow(NotFoundException);
    });

    it('returns defaults or configured passwords', () => {
      expect(svc.getTestCredentials().admin.password).toBe('Admin@123');
      env.ADMIN_PASSWORD = 'a';
      env.TEACHER_PASSWORD = 't';
      env.STUDENT_PASSWORD = 's';
      const c = svc.getTestCredentials();
      expect([c.admin.password, c.teacher.password, c.student.password]).toEqual(['a', 't', 's']);
    });
  });
});
