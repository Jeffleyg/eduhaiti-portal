import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { autoMock, AutoMock } from '../../test-utils/auto-mock';
import { TenantService } from './tenant.service';

describe('TenantService', () => {
  let prisma: PrismaMock;
  let audit: AutoMock;
  let svc: TenantService;
  const config = {
    id: 'cfg',
    schoolId: 's',
    maxStudents: 10,
    maxTeachers: 2,
    maxClasses: 0,
    enableCustomDomain: true,
    enableSso: false,
    enableAdvancedAnalytics: true,
    enableApiAccess: false,
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = autoMock();
    svc = new TenantService(prisma as any, audit as any);
  });

  it('creates a tenant with default limits', async () => {
    prisma.school.create.mockResolvedValue({ id: 's' });
    prisma.school.findUnique.mockResolvedValue({ id: 's', tenantConfig: config });
    const r = await svc.createTenant({ name: 'S', email: 'e' } as any);
    expect(prisma.tenantConfiguration.create.mock.calls[0][0].data).toEqual({
      schoolId: 's',
      maxStudents: 1000,
      maxTeachers: 100,
      maxClasses: 50,
      storageLimitGb: 10,
    });
    expect(r.tenantConfig).toEqual(config);
    await svc.createTenant({ name: 'S', email: 'e', maxStudents: 5, maxTeachers: 1, maxClasses: 2, storageLimitGb: 3 } as any);
    expect(prisma.tenantConfiguration.create.mock.calls[1][0].data).toMatchObject({ maxStudents: 5, storageLimitGb: 3 });
  });

  it('lists and reads tenants', async () => {
    prisma.school.findMany.mockResolvedValue([{ id: 'a', tenantConfig: config }, { id: 'b', tenantConfig: null }]);
    prisma.school.count.mockResolvedValue(2);
    const list = await svc.listTenants();
    expect(list).toMatchObject({ total: 2, skip: 0, take: 50 });
    expect(list.data[1].tenantConfig).toBeNull();
    await svc.listTenants(1, 2);

    prisma.school.findUnique.mockResolvedValueOnce(null);
    await expect(svc.getTenant('x')).rejects.toBeInstanceOf(NotFoundException);
    prisma.school.findUnique.mockResolvedValueOnce({ id: 'b', tenantConfig: null });
    expect((await svc.getTenant('b')).tenantConfig).toBeNull();
  });

  it('delegates limits and white label', async () => {
    prisma.tenantConfiguration.findUnique.mockResolvedValue(config);
    prisma.tenantConfiguration.update.mockResolvedValue(config);
    await svc.updateTenantLimits('s', { maxStudents: 5 } as any);
    await svc.configureWhiteLabel('s', { primaryColor: '#fff' } as any);
    expect(prisma.tenantConfiguration.update.mock.calls.map((c: any) => c[0].data)).toEqual([
      { maxStudents: 5 },
      { primaryColor: '#fff' },
    ]);
  });

  it('reports usage', async () => {
    prisma.user.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    prisma.class.count.mockResolvedValue(2);
    expect(await svc.getTenantUsage('s')).toEqual({ tenantId: 's', students: 3, teachers: 1, classes: 2 });
  });

  it('soft deletes a tenant', async () => {
    prisma.tenantConfiguration.findUnique.mockResolvedValue(config);
    prisma.tenantConfiguration.update.mockResolvedValue(config);
    expect(await svc.softDeleteTenant('s', 'u')).toEqual({ success: true, message: 'Tenant soft-deleted' });
    expect(audit.log).toHaveBeenCalledTimes(1);
    await svc.softDeleteTenant('s');
    expect(audit.log).toHaveBeenCalledTimes(1);
    prisma.tenantConfiguration.findUnique.mockResolvedValue(null);
    await expect(svc.deleteTenantConfig('s')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gets tenant config', async () => {
    prisma.tenantConfiguration.findUnique.mockResolvedValueOnce(null);
    await expect(svc.getTenantConfig('s')).rejects.toBeInstanceOf(NotFoundException);
    prisma.tenantConfiguration.findUnique.mockResolvedValueOnce(config);
    expect(await svc.getTenantConfig('s')).toEqual(config);
  });

  describe('createTenantConfig', () => {
    it('validates school, duplicates and limits', async () => {
      prisma.school.findUnique.mockResolvedValueOnce(null);
      await expect(svc.createTenantConfig('s', {} as any)).rejects.toBeInstanceOf(NotFoundException);
      prisma.school.findUnique.mockResolvedValue({ id: 's', name: 'S' });
      prisma.tenantConfiguration.findUnique.mockResolvedValueOnce(config);
      await expect(svc.createTenantConfig('s', {} as any)).rejects.toThrow('already exists');
      prisma.tenantConfiguration.findUnique.mockResolvedValue(null);
      await expect(svc.createTenantConfig('s', { maxStudents: 0 } as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates and audits with a user', async () => {
      prisma.school.findUnique.mockResolvedValue({ id: 's', name: 'S' });
      prisma.tenantConfiguration.findUnique.mockResolvedValue(null);
      prisma.tenantConfiguration.create.mockResolvedValue(config);
      await svc.createTenantConfig('s', { maxStudents: 5 } as any, 'u');
      await svc.createTenantConfig('s', { maxStudents: 5 } as any);
      expect(audit.log).toHaveBeenCalledTimes(1);
      expect(prisma.tenantConfiguration.create.mock.calls[0][0].data).toEqual({ schoolId: 's', maxStudents: 5 });
    });
  });

  describe('updateTenantConfig', () => {
    it('validates existence and limits', async () => {
      prisma.tenantConfiguration.findUnique.mockResolvedValueOnce(null);
      await expect(svc.updateTenantConfig('s', {} as any)).rejects.toBeInstanceOf(NotFoundException);
      prisma.tenantConfiguration.findUnique.mockResolvedValue(config);
      await expect(svc.updateTenantConfig('s', { maxStudents: -1 } as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('updates and audits with a user', async () => {
      prisma.tenantConfiguration.findUnique.mockResolvedValue(config);
      prisma.tenantConfiguration.update.mockResolvedValue(config);
      await svc.updateTenantConfig('s', { maxStudents: 0 } as any, 'u');
      expect(audit.log.mock.calls[0][0]).toMatchObject({ action: 'UPDATE', oldValues: config });
    });
  });

  it('lists tenant configs', async () => {
    prisma.tenantConfiguration.findMany.mockResolvedValue([config]);
    prisma.tenantConfiguration.count.mockResolvedValue(1);
    expect(await svc.listTenantConfigs()).toEqual({ data: [config], total: 1, skip: 0, take: 50 });
    await svc.listTenantConfigs(2, 3);
    expect(prisma.tenantConfiguration.findMany.mock.calls[1][0]).toMatchObject({ skip: 2, take: 3 });
  });

  it('updates white label with or without audit', async () => {
    prisma.tenantConfiguration.findUnique.mockResolvedValueOnce(null);
    await expect(svc.updateWhiteLabel('s', {})).rejects.toBeInstanceOf(NotFoundException);
    prisma.tenantConfiguration.findUnique.mockResolvedValue(config);
    prisma.tenantConfiguration.update.mockResolvedValue(config);
    await svc.updateWhiteLabel('s', { logoUrl: 'l' }, 'u');
    expect(audit.log.mock.calls[0][0].description).toBe('Updated White Label configuration');
  });

  it('checks limits and features', async () => {
    prisma.tenantConfiguration.findUnique.mockResolvedValue(config);
    expect(await svc.checkTenantLimits('s', 'students', 4)).toEqual({ allowed: true, current: 4, limit: 10, remaining: 6 });
    expect(await svc.checkTenantLimits('s', 'teachers', 2)).toMatchObject({ allowed: false, remaining: 0 });
    expect(await svc.checkTenantLimits('s', 'classes', 99)).toEqual({ allowed: true });
    expect(await svc.checkTenantLimits('s', 'storage', 99)).toEqual({ allowed: true });
    expect(await svc.getTenantFeatures('s')).toEqual({
      customDomain: true,
      sso: false,
      advancedAnalytics: true,
      apiAccess: false,
    });
  });
});
