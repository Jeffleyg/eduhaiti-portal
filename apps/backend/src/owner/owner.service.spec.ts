import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { autoMock, AutoMock } from '../test-utils/auto-mock';

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { hash: jest.fn(async (v: string) => `hash:${v}`) },
}));

import { OwnerService } from './owner.service';

describe('OwnerService', () => {
  let prisma: PrismaMock;
  let email: AutoMock;
  let svc: OwnerService;
  const school = { id: 's', name: 'Lycée', email: 'l@x' };

  beforeEach(() => {
    prisma = createPrismaMock();
    email = autoMock();
    svc = new OwnerService(prisma as any, email as any);
  });
  afterEach(() => {
    delete process.env.FRONTEND_URL;
  });

  it('lists schools', async () => {
    await svc.listAllSchools();
    expect(prisma.school.findMany).toHaveBeenCalled();
  });

  it('gets school details', async () => {
    prisma.school.findUnique.mockResolvedValueOnce(null);
    await expect(svc.getSchoolDetails('s')).rejects.toBeInstanceOf(NotFoundException);
    prisma.school.findUnique.mockResolvedValueOnce(school);
    await expect(svc.getSchoolDetails('s')).resolves.toBe(school);
  });

  describe('createSchool', () => {
    beforeEach(() => {
      prisma.school.findFirst.mockResolvedValue(null);
      prisma.school.create.mockResolvedValue(school);
      prisma.user.findUnique.mockResolvedValue(null);
    });

    it('rejects duplicate schools', async () => {
      prisma.school.findFirst.mockResolvedValueOnce(school);
      await expect(svc.createSchool({ name: 'Lycée', email: 'l@x' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses an admin e-mail that already belongs to someone, before creating anything', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'owner' });
      await expect(
        svc.createSchool({ name: 'Lycée', email: 'l@x', adminEmail: ' Owner@X ' }),
      ).rejects.toThrow('já está cadastrado');
      expect(prisma.user.findUnique.mock.calls[0][0].where).toEqual({ email: 'owner@x' });
      expect(prisma.school.create).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates with defaults and no admin', async () => {
      await expect(svc.createSchool({ name: 'Lycée', email: 'l@x' })).resolves.toEqual({ school, adminAccount: null });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.school.create.mock.calls[0][0].data).toMatchObject({
        phone: null,
        city: 'Port-au-Prince',
        country: 'Haiti',
        enableFinance: true,
        enableGamification: false,
      });
      expect(prisma.schoolUsageAnalytic.create).toHaveBeenCalledWith({ data: { schoolId: 's' } });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(email.sendTempPasswordEmail).not.toHaveBeenCalled();
    });

    it('creates with explicit options and an admin who must change the password', async () => {
      const r = await svc.createSchool({
        name: 'Lycée',
        email: 'l@x',
        phone: '1',
        address: 'a',
        city: 'Cap',
        country: 'HT',
        principal: 'P',
        enableFinance: false,
        enableFamilyAccess: false,
        enablePayment: false,
        enableSync: false,
        enableLessons: false,
        enableGamification: true,
        enableForums: true,
        enableInventory: true,
        adminName: 'Marie Claire Joseph',
        adminEmail: ' ADMIN@X ',
        adminPassword: 'Secret1!',
      });
      expect(prisma.school.create.mock.calls[0][0].data).toMatchObject({ city: 'Cap', enableFinance: false, enableInventory: true });
      expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
        email: 'admin@x',
        firstName: 'Marie',
        lastName: 'Claire Joseph',
        name: 'Marie Claire Joseph',
        passwordHash: 'hash:Secret1!',
        role: 'ADMIN',
        schoolId: 's',
        mustChangePassword: true,
        tempPasswordExpiresAt: expect.any(Date),
      });
      expect(email.sendTempPasswordEmail).toHaveBeenCalledWith('admin@x', 'Secret1!', expect.any(Date));
      expect(r.adminAccount).toEqual({ email: 'admin@x', emailSent: expect.anything() });
    });

    it('generates a password, derives names and returns the password once when e-mail fails', async () => {
      email.sendTempPasswordEmail.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('smtp'));
      const first = await svc.createSchool({ name: 'Lycée', email: 'l@x', adminEmail: 'a@x' });
      const second = await svc.createSchool({ name: 'Lycée', email: 'l@x', adminEmail: 'b@x', adminName: 'Solo' });
      const [a, b] = prisma.user.create.mock.calls.map((c: any) => c[0].data);
      expect(a).toMatchObject({ firstName: 'Admin', lastName: 'Lycée', name: 'Admin - Lycée' });
      expect(a.passwordHash).toMatch(/^hash:.{12}$/);
      expect(b).toMatchObject({ firstName: 'Solo', lastName: 'Lycée' });
      expect(first.adminAccount).toEqual({ email: 'a@x', emailSent: false, tempPassword: a.passwordHash.slice(5) });
      expect(second.adminAccount).toMatchObject({ email: 'b@x', emailSent: false, tempPassword: expect.any(String) });
    });
  });

  describe('updateSchool', () => {
    it('validates the school and email uniqueness', async () => {
      prisma.school.findUnique.mockResolvedValueOnce(null);
      await expect(svc.updateSchool('s', {})).rejects.toBeInstanceOf(NotFoundException);
      prisma.school.findUnique.mockResolvedValueOnce(school).mockResolvedValueOnce({ id: 'other' });
      await expect(svc.updateSchool('s', { email: 'taken@x' })).rejects.toThrow('Email already in use');
    });

    it('updates only provided fields', async () => {
      prisma.school.findUnique.mockResolvedValueOnce(school).mockResolvedValueOnce(null);
      await svc.updateSchool('s', {
        name: 'N',
        email: 'new@x',
        phone: 'p',
        address: 'a',
        city: 'c',
        country: 'co',
        principal: 'pr',
      });
      prisma.school.findUnique.mockResolvedValueOnce(school);
      await svc.updateSchool('s', { email: 'l@x' });
      prisma.school.findUnique.mockResolvedValueOnce(school);
      await svc.updateSchool('s', {});
      const data = prisma.school.update.mock.calls.map((c: any) => c[0].data);
      expect(Object.keys(data[0])).toHaveLength(7);
      expect(data[1]).toEqual({ email: 'l@x' });
      expect(data[2]).toEqual({});
    });
  });

  it('deletes schools', async () => {
    prisma.school.findUnique.mockResolvedValueOnce(null);
    await expect(svc.deleteSchool('s')).rejects.toBeInstanceOf(NotFoundException);
    prisma.school.findUnique.mockResolvedValueOnce(school);
    await svc.deleteSchool('s');
    expect(prisma.school.delete).toHaveBeenCalledWith({ where: { id: 's' } });
  });

  it('gets and updates features', async () => {
    prisma.school.findUnique.mockResolvedValue(null);
    await expect(svc.getSchoolFeatures('s')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.updateSchoolFeatures('s', {})).rejects.toBeInstanceOf(NotFoundException);
    prisma.school.findUnique.mockResolvedValue(school);
    await expect(svc.getSchoolFeatures('s')).resolves.toBe(school);
    await svc.updateSchoolFeatures('s', { enableForums: true });
    expect(prisma.school.update.mock.calls[0][0].data).toEqual({ enableForums: true });
  });

  it('gets analytics for a school', async () => {
    prisma.schoolUsageAnalytic.findUnique.mockResolvedValueOnce(null);
    await expect(svc.getSchoolAnalytics('s')).rejects.toBeInstanceOf(NotFoundException);
    prisma.schoolUsageAnalytic.findUnique.mockResolvedValueOnce({ schoolId: 's' });
    await expect(svc.getSchoolAnalytics('s')).resolves.toEqual({ schoolId: 's' });
  });

  it('summarizes analytics across schools', async () => {
    const last = new Date();
    prisma.school.findMany.mockResolvedValue([
      {
        id: 'a',
        name: 'A',
        usageAnalytics: {
          totalLogins: 2,
          totalUsers: 3,
          studentCount: 4,
          teacherCount: 5,
          classCount: 6,
          lastActivityAt: last,
          gradeCreations: 7,
          attendanceRecords: 8,
          messagesSent: 9,
        },
      },
      { id: 'b', name: 'B', usageAnalytics: null },
    ]);
    const r = await svc.getAnalyticsSummary();
    expect(r).toMatchObject({
      totalSchools: 2,
      totalLogins: 2,
      totalUsers: 3,
      totalGrades: 7,
      totalAttendance: 8,
      totalMessages: 9,
    });
    expect(r.schoolsDetails[0]).toMatchObject({ logins: 2, lastActivity: last });
    expect(r.schoolsDetails[1]).toEqual({
      id: 'b',
      name: 'B',
      logins: 0,
      users: 0,
      students: 0,
      teachers: 0,
      classes: 0,
      lastActivity: undefined,
    });
  });

  it('tracks usage, creating the record when missing', async () => {
    await svc.trackUsage('s', 'totalLogins');
    expect(prisma.schoolUsageAnalytic.update.mock.calls[0][0].data.totalLogins).toEqual({ increment: 1 });
    prisma.schoolUsageAnalytic.update.mockRejectedValueOnce(new Error('missing'));
    await svc.trackUsage('s', 'messagesSent', 3);
    expect(prisma.schoolUsageAnalytic.create).toHaveBeenCalledWith({ data: { schoolId: 's', messagesSent: 3 } });
  });

  describe('permission codes', () => {
    it('generates codes with optional expiry and share URL', async () => {
      prisma.school.findUnique.mockResolvedValueOnce(null);
      await expect(svc.generatePermissionCode('s', {})).rejects.toBeInstanceOf(NotFoundException);

      prisma.school.findUnique.mockResolvedValue(school);
      prisma.schoolPermissionCode.create.mockImplementation(async (a: any) => ({ id: 'pc', ...a.data }));
      const r = await svc.generatePermissionCode('s', { name: 'n', expiresIn: 2 });
      expect(r.code).toMatch(/^[0-9A-F]{8}$/);
      expect(r.expiresAt).toBeInstanceOf(Date);
      expect(r.shareUrl).toBe(`http://localhost:5173/redeem-access?code=${r.code}`);

      process.env.FRONTEND_URL = 'https://app';
      const r2 = await svc.generatePermissionCode('s', {});
      expect(r2.expiresAt).toBeNull();
      expect(r2.shareUrl.startsWith('https://app/')).toBe(true);
    });

    it('lists and revokes codes', async () => {
      prisma.school.findUnique.mockResolvedValueOnce(null);
      await expect(svc.listPermissionCodes('s')).rejects.toBeInstanceOf(NotFoundException);
      prisma.school.findUnique.mockResolvedValueOnce(school);
      await svc.listPermissionCodes('s');
      expect(prisma.schoolPermissionCode.findMany.mock.calls[0][0].where).toEqual({ schoolId: 's', isActive: true });

      prisma.schoolPermissionCode.findUnique.mockResolvedValueOnce(null);
      await expect(svc.revokePermissionCode('c')).rejects.toBeInstanceOf(NotFoundException);
      prisma.schoolPermissionCode.findUnique.mockResolvedValueOnce({ id: 'c' });
      await svc.revokePermissionCode('c');
      expect(prisma.schoolPermissionCode.update).toHaveBeenCalledWith({ where: { id: 'c' }, data: { isActive: false } });
    });

    describe('verifyPermissionCode', () => {
      const code = { id: 'pc', name: 'Admins', school };

      beforeEach(() => {
        prisma.schoolPermissionCode.updateMany.mockResolvedValue({ count: 1 });
      });

      it('rejects invalid, used and expired codes', async () => {
        prisma.schoolPermissionCode.findFirst.mockResolvedValue(null);
        await expect(svc.verifyPermissionCode('abc', 'a@x')).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.schoolPermissionCode.findFirst.mock.calls[0][0].where).toMatchObject({
          code: 'ABC',
          isActive: true,
          usedAt: null,
        });
      });

      it('claims the code and creates the admin in one transaction, then emails', async () => {
        prisma.schoolPermissionCode.findFirst.mockResolvedValue(code);
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockImplementation(async (a: any) => ({ id: 'u', ...a.data }));
        const r = await svc.verifyPermissionCode('abc', ' New@X ', 'Jean Baptiste Louis');
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.schoolPermissionCode.updateMany.mock.calls[0][0]).toMatchObject({
          where: { id: 'pc', usedAt: null },
          data: { usedBy: 'new@x' },
        });
        expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
          email: 'new@x',
          firstName: 'Jean',
          lastName: 'Baptiste Louis',
          role: 'ADMIN',
          schoolId: 's',
          mustChangePassword: true,
        });
        expect(email.sendTempPasswordEmail).toHaveBeenCalled();
        expect(r).toMatchObject({ success: true, schoolId: 's', userId: 'u', permissionName: 'Admins' });
        expect(r).not.toHaveProperty('tempPassword');
      });

      it('uses default names and returns the password once when email fails', async () => {
        prisma.schoolPermissionCode.findFirst.mockResolvedValue(code);
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockImplementation(async (a: any) => ({ id: 'u', ...a.data }));
        email.sendTempPasswordEmail.mockRejectedValueOnce(new Error('smtp'));
        const r = await svc.verifyPermissionCode('abc', 'x@x');
        expect(r).toMatchObject({ emailSent: false, tempPassword: expect.any(String) });
        expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
          name: 'Admin - Lycée',
          firstName: 'Admin',
          lastName: 'Lycée',
        });
        email.sendTempPasswordEmail.mockResolvedValueOnce(false);
        await svc.verifyPermissionCode('abc', 'y@x', 'Solo');
        expect(prisma.user.create.mock.calls[1][0].data).toMatchObject({ firstName: 'Solo', lastName: 'Lycée' });
      });

      it('refuses existing emails without burning the code', async () => {
        prisma.schoolPermissionCode.findFirst.mockResolvedValue(code);
        prisma.user.findUnique.mockResolvedValue({ id: 'old' });
        await expect(svc.verifyPermissionCode('abc', 'a@x')).rejects.toThrow('already registered');
        expect(prisma.schoolPermissionCode.updateMany).not.toHaveBeenCalled();
        expect(prisma.user.create).not.toHaveBeenCalled();
      });

      it('fails when a concurrent redeem claimed the code first', async () => {
        prisma.schoolPermissionCode.findFirst.mockResolvedValue(code);
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.schoolPermissionCode.updateMany.mockResolvedValue({ count: 0 });
        await expect(svc.verifyPermissionCode('abc', 'a@x')).rejects.toThrow('Invalid or expired');
        expect(prisma.user.create).not.toHaveBeenCalled();
        expect(email.sendTempPasswordEmail).not.toHaveBeenCalled();
      });
    });
  });
});
