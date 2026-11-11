import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { autoMock, AutoMock } from '../../test-utils/auto-mock';
import { PermissionService } from './permission.service';
import { AuditService } from './audit.service';

describe('PermissionService', () => {
  let prisma: PrismaMock;
  let audit: AutoMock;
  let svc: PermissionService;
  const key = { schoolId_role_resource: { schoolId: 's', role: 'TEACHER', resource: 'grades' } };

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = autoMock();
    svc = new PermissionService(prisma as any, audit as any);
  });

  describe('setRolePermission', () => {
    it('validates input and permission names', async () => {
      await expect(svc.setRolePermission('s', { role: '', resource: 'r', permissions: 'READ' } as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        svc.setRolePermission('s', { role: 'R', resource: 'r', permissions: 'READ, fly' } as any),
      ).rejects.toThrow('Invalid permission: FLY');
    });

    it('creates or updates and audits only with a user', async () => {
      const dto = { role: 'TEACHER', resource: 'grades', permissions: 'read, write' } as any;
      prisma.rolePermission.findUnique.mockResolvedValueOnce(null);
      prisma.rolePermission.create.mockResolvedValue({ id: 'p' });
      await svc.setRolePermission('s', dto, 'u');
      prisma.rolePermission.findUnique.mockResolvedValueOnce(null);
      await svc.setRolePermission('s', dto);

      prisma.rolePermission.findUnique.mockResolvedValue({ id: 'p' });
      prisma.rolePermission.update.mockResolvedValue({ id: 'p' });
      await svc.setRolePermission('s', dto, 'u');
      await svc.setRolePermission('s', dto);

      expect(prisma.rolePermission.findUnique.mock.calls[0][0].where).toEqual(key);
      expect(prisma.rolePermission.create).toHaveBeenCalledTimes(2);
      expect(prisma.rolePermission.update).toHaveBeenCalledTimes(2);
      expect(audit.log.mock.calls.map((c: any) => c[0].description)).toEqual([
        'Granted permissions for role TEACHER on grades',
        'Updated permissions for role TEACHER on grades',
      ]);
    });
  });

  it('reads role permissions', async () => {
    await svc.getRolePermissions('s', 'ADMIN');
    expect(prisma.rolePermission.findMany.mock.calls[0][0].where).toEqual({ schoolId: 's', role: 'ADMIN', isActive: true });
  });

  it('checks single and multiple permissions', async () => {
    prisma.rolePermission.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ isActive: false, permissions: 'READ' })
      .mockResolvedValueOnce({ isActive: true, permissions: 'READ,WRITE' })
      .mockResolvedValueOnce({ isActive: true, permissions: 'READ' });
    expect(await svc.checkPermission('s', 'TEACHER', 'grades', 'READ')).toBe(false);
    expect(await svc.checkPermission('s', 'TEACHER', 'grades', 'READ')).toBe(false);
    expect(await svc.checkPermission('s', 'TEACHER', 'grades', 'WRITE')).toBe(true);
    expect(await svc.checkPermission('s', 'TEACHER', 'grades', 'DELETE')).toBe(false);

    prisma.rolePermission.findUnique
      .mockResolvedValueOnce({ isActive: true, permissions: 'READ' })
      .mockResolvedValueOnce(null);
    expect(
      await svc.checkPermissions('s', 'TEACHER', [
        { resource: 'a', action: 'READ' },
        { resource: 'b', action: 'WRITE' },
      ]),
    ).toEqual({ allowed: false, denied: ['WRITE:b'] });
    prisma.rolePermission.findUnique.mockResolvedValueOnce({ isActive: true, permissions: 'READ' });
    expect(await svc.checkPermissions('s', 'T', [{ resource: 'a', action: 'READ' }])).toEqual({ allowed: true, denied: [] });
  });

  it('lists with pagination defaults', async () => {
    prisma.rolePermission.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.rolePermission.count.mockResolvedValue(1);
    expect(await svc.listRolePermissions('s')).toEqual({ data: [{ id: 1 }], total: 1, skip: 0, take: 50 });
    expect(await svc.listRolePermissions('s', 5, 10)).toMatchObject({ skip: 5, take: 10 });
  });

  it('revokes permissions', async () => {
    prisma.rolePermission.findUnique.mockResolvedValueOnce(null);
    await expect(svc.revokePermission('s', 'TEACHER', 'grades')).rejects.toBeInstanceOf(NotFoundException);
    prisma.rolePermission.findUnique.mockResolvedValue({ id: 'p' });
    prisma.rolePermission.update.mockResolvedValue({ id: 'p' });
    await expect(svc.revokePermission('s', 'TEACHER', 'grades', 'u')).resolves.toEqual({
      success: true,
      message: 'Permission revoked',
    });
    await svc.revokePermission('s', 'TEACHER', 'grades');
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(prisma.rolePermission.update.mock.calls[0][0].data).toEqual({ isActive: false });
  });

  it('builds the permission matrix', async () => {
    prisma.rolePermission.findMany.mockResolvedValue([
      { role: 'ADMIN', resource: 'grades', permissions: 'READ, WRITE' },
      { role: 'ADMIN', resource: 'users', permissions: 'READ' },
      { role: 'TEACHER', resource: 'grades', permissions: 'READ' },
    ]);
    expect(await svc.getPermissionMatrix('s')).toEqual({
      ADMIN: { grades: ['READ', 'WRITE'], users: ['READ'] },
      TEACHER: { grades: ['READ'] },
    });
  });

  it('creates the default permission set', async () => {
    prisma.rolePermission.create.mockImplementation(async (a: any) => a.data);
    const created = await svc.createDefaultPermissions('s');
    expect(created.length).toBe(28);
    expect(new Set(created.map((c: any) => c.role))).toEqual(new Set(['ADMIN', 'TEACHER', 'SECRETARY', 'STUDENT']));
  });
});

describe('AuditService', () => {
  let prisma: PrismaMock;
  let svc: AuditService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new AuditService(prisma as any);
  });

  it('logs with a summary and swallows failures', async () => {
    await svc.log({ userId: 'u', action: 'CREATE', resource: 'School', resourceId: 's' });
    await svc.log({ userId: 'u', action: 'READ', resource: 'Grade' });
    expect(prisma.auditLog.create.mock.calls.map((c: any) => c[0].data.changesSummary)).toEqual([
      'CREATE on School (s)',
      'READ on Grade',
    ]);
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    prisma.auditLog.create.mockRejectedValueOnce(new Error('db'));
    await expect(svc.log({ userId: 'u', action: 'X', resource: 'Y' })).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('queries with filters and date ranges', async () => {
    prisma.auditLog.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.auditLog.count.mockResolvedValue(1);
    const d1 = new Date('2026-01-01');
    const d2 = new Date('2026-02-01');
    expect(await svc.query()).toEqual({ data: [{ id: 1 }], total: 1, skip: 0, take: 50 });
    await svc.query({ userId: 'u', startDate: d1, endDate: d2, skip: 2, take: 3 });
    await svc.query({ startDate: d1 });
    await svc.query({ endDate: d2 });
    const where = prisma.auditLog.findMany.mock.calls.map((c: any) => c[0].where);
    expect(where[0]).toEqual({});
    expect(where[1]).toEqual({ userId: 'u', createdAt: { gte: d1, lte: d2 } });
    expect(where[2]).toEqual({ createdAt: { gte: d1 } });
    expect(where[3]).toEqual({ createdAt: { lte: d2 } });
  });

  it('summarizes activity', async () => {
    prisma.auditLog.groupBy.mockResolvedValue([]);
    const d1 = new Date('2026-01-01');
    const d2 = new Date('2026-02-01');
    await svc.getActivitySummary(d1, d2, 's');
    await svc.getActivitySummary(d1, d2);
    expect(prisma.auditLog.groupBy.mock.calls[0][0].where).toEqual({ createdAt: { gte: d1, lte: d2 }, schoolId: 's' });
    expect(prisma.auditLog.groupBy.mock.calls[3][0].where).toEqual({ createdAt: { gte: d1, lte: d2 } });
  });

  it('builds user timelines', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      { createdAt: new Date(), action: 'A', resource: 'R', description: 'd', ipAddress: '1' },
    ]);
    expect((await svc.getUserActivityTimeline('u'))[0]).toMatchObject({ action: 'A', ip: '1' });
    await svc.getUserActivityTimeline('u', 7);
  });

  it('generates compliance reports grouped by date', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      { createdAt: new Date('2026-01-01T10:00:00Z'), user: { email: 'a@x' }, action: 'A', resource: 'R', description: null },
      { createdAt: new Date('2026-01-01T11:00:00Z'), user: null, action: 'B', resource: 'R', description: null },
      { createdAt: new Date('2026-01-02T10:00:00Z'), user: null, action: 'C', resource: 'R', description: null },
    ]);
    const r = await svc.generateComplianceReport(new Date('2026-01-01'), new Date('2026-01-03'), 'R', 's');
    expect(r.report.totalEvents).toBe(3);
    expect(Object.keys(r.report.eventsByDate)).toEqual(['2026-01-01', '2026-01-02']);
    expect(r.report.eventsByDate['2026-01-01'][1].user).toBeUndefined();
    await svc.generateComplianceReport(new Date(), new Date());
    expect(prisma.auditLog.findMany.mock.calls[1][0].where).not.toHaveProperty('resource');
  });

  it('detects suspicious activity', async () => {
    const many = (action: string, n: number) => Array.from({ length: n }, () => ({ action, ipAddress: '1' }));
    prisma.auditLog.findMany.mockResolvedValueOnce([]);
    expect((await svc.detectSuspiciousActivity('u')).isSuspicious).toBe(false);

    prisma.auditLog.findMany.mockResolvedValueOnce([
      ...many('DELETE', 6),
      ...many('FAILED_LOGIN', 4),
      ...many('PERMISSION_GRANT', 2),
      ...many('PERMISSION_REVOKE', 1),
      ...many('EXPORT', 2),
      { action: 'X', ipAddress: '2' },
      { action: 'X', ipAddress: '3' },
    ]);
    const r = await svc.detectSuspiciousActivity('u', 2);
    expect(r.isSuspicious).toBe(true);
    expect(Object.values(r.patterns).every(Boolean)).toBe(true);
    expect(r.recentActivity).toHaveLength(10);
  });

  it('archives old logs', async () => {
    prisma.auditLog.deleteMany.mockResolvedValue({ count: 4 });
    expect((await svc.archiveOldLogs()).archived).toBe(4);
    await svc.archiveOldLogs(30);
  });

  it('returns resource change history', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      { createdAt: new Date(), user: { email: 'a' }, action: 'U', oldValues: 1, newValues: 2, description: 'd' },
      { createdAt: new Date(), user: null, action: 'U', oldValues: null, newValues: null, description: null },
    ]);
    const r = await svc.getResourceChangeHistory('School', 's');
    expect(r.map((x) => x.user)).toEqual(['a', undefined]);
  });

  it('exports CSV with escaping and fallbacks', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-01-01T00:00:00Z'),
        user: { email: 'a@x' },
        action: 'A',
        resource: 'R',
        resourceId: 'id',
        description: 'say "hi"',
        ipAddress: '1.1.1.1',
      },
      { createdAt: new Date('2026-01-01T00:00:00Z'), user: null, action: 'B', resource: 'R' },
    ]);
    prisma.auditLog.count.mockResolvedValue(2);
    const r = await svc.exportToCSV({ resource: 'R' });
    const lines = r.content.split('\n');
    expect(lines[0]).toContain('"Timestamp"');
    expect(lines[1]).toContain('"say ""hi"""');
    expect(lines[2]).toBe('"2026-01-01T00:00:00.000Z","N/A","B","R","N/A","N/A","N/A"');
    expect(r.mimeType).toBe('text/csv');
    expect(prisma.auditLog.findMany.mock.calls[0][0].take).toBe(10000);
  });
});
