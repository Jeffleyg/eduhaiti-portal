import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { autoMock, AutoMock } from '../test-utils/auto-mock';
import { OwnerController } from './owner.controller';

describe('OwnerController', () => {
  let owner: AutoMock;
  let tenant: AutoMock;
  let permission: AutoMock;
  let settings: AutoMock;
  let audit: AutoMock;
  let metrics: AutoMock;
  let ctrl: OwnerController;

  const req = (user: Record<string, unknown> = { sub: 'o', role: 'OWNER' }) => ({
    user,
    ip: '1.1.1.1',
    get: jest.fn().mockReturnValue('jest-agent'),
  });

  beforeEach(() => {
    owner = autoMock();
    tenant = autoMock();
    permission = autoMock();
    settings = autoMock();
    audit = autoMock();
    metrics = autoMock();
    ctrl = new OwnerController(
      owner as any,
      tenant as any,
      permission as any,
      settings as any,
      audit as any,
      metrics as any,
    );
  });

  describe('tenants', () => {
    it('creates a tenant and logs it', async () => {
      tenant.createTenant.mockResolvedValue({ id: 't1' });
      await expect(ctrl.createTenant({ name: 'A' } as any, req())).resolves.toEqual({
        success: true,
        tenant: { id: 't1' },
        message: 'Tenant created successfully',
      });
      expect(audit.log.mock.calls[0][0]).toMatchObject({
        userId: 'o',
        action: 'TENANT_CREATED',
        resourceId: 't1',
        userAgent: 'jest-agent',
      });
      await ctrl.createTenant({ name: 'B' } as any, { ...req(), user: undefined });
      expect(audit.log.mock.calls[1][0].userId).toBeUndefined();
    });

    it('lists, reads and reports usage', async () => {
      await ctrl.listTenants();
      await ctrl.listTenants(5, 10);
      await ctrl.getTenant('t');
      await ctrl.getTenantUsage('t');
      expect(tenant.listTenants.mock.calls).toEqual([
        [0, 50],
        [5, 10],
      ]);
      expect(tenant.getTenant).toHaveBeenCalledWith('t');
      expect(tenant.getTenantUsage).toHaveBeenCalledWith('t');
    });

    it('updates limits, white label and deletes with audit', async () => {
      await ctrl.updateTenantLimits('t', { maxStudents: 1 } as any, req());
      await ctrl.configureWhiteLabel('t', { logo: 'x' } as any, req());
      await ctrl.deleteTenant('t', req());
      await ctrl.updateTenantLimits('t', {} as any, { ip: 'x' });
      await ctrl.configureWhiteLabel('t', {} as any, { ip: 'x' });
      await ctrl.deleteTenant('t', { ip: 'x' });
      expect(tenant.updateTenantLimits).toHaveBeenCalledWith('t', { maxStudents: 1 });
      expect(tenant.configureWhiteLabel).toHaveBeenCalledWith('t', { logo: 'x' });
      expect(tenant.softDeleteTenant).toHaveBeenCalledWith('t');
      expect(audit.log.mock.calls.map((c: any) => c[0].action)).toEqual([
        'TENANT_LIMITS_UPDATED',
        'WHITE_LABEL_UPDATED',
        'TENANT_DELETED',
        'TENANT_LIMITS_UPDATED',
        'WHITE_LABEL_UPDATED',
        'TENANT_DELETED',
      ]);
    });
  });

  describe('rbac', () => {
    const school = { sub: 'o', role: 'OWNER', schoolId: 's1' };
    const owner = { sub: 'o', role: 'OWNER' };

    it('requires an existing target school instead of a fake "global" id', async () => {
      await expect(ctrl.setRolePermission({} as any, req(owner))).rejects.toBeInstanceOf(BadRequestException);
      await expect(ctrl.getPermissionMatrix(req(owner), '  ')).rejects.toBeInstanceOf(BadRequestException);
      expect(permission.setRolePermission).not.toHaveBeenCalled();

      tenant.getTenant.mockRejectedValueOnce(new NotFoundException());
      await expect(ctrl.listPermissions(0, 50, req(owner), 'ghost')).rejects.toBeInstanceOf(NotFoundException);
      expect(permission.listRolePermissions).not.toHaveBeenCalled();
    });

    it("sets and reads permissions for the caller's or the requested school", async () => {
      permission.setRolePermission.mockResolvedValue({ id: 'p' });
      permission.getRolePermissions.mockResolvedValue([1, 2]);
      permission.getPermissionMatrix.mockResolvedValue({ ADMIN: {}, TEACHER: {} });

      await expect(ctrl.setRolePermission({ role: 'ADMIN' } as any, req(school))).resolves.toEqual({
        success: true,
        permission: { id: 'p' },
        message: 'Permission granted successfully',
      });
      await ctrl.setRolePermission({} as any, req(owner), ' s2 ');
      expect(permission.setRolePermission.mock.calls.map((c: any) => c[0])).toEqual(['s1', 's2']);
      expect(tenant.getTenant.mock.calls).toEqual([['s1'], ['s2']]);

      await expect(ctrl.getRolePermissions('ADMIN', req(school))).resolves.toEqual({
        role: 'ADMIN',
        permissions: [1, 2],
        count: 2,
      });
      await ctrl.getRolePermissions('ADMIN', req(owner), 's2');
      expect(permission.getRolePermissions.mock.calls.map((c: any) => c[0])).toEqual(['s1', 's2']);

      await ctrl.listPermissions(undefined, undefined, req(school));
      await ctrl.listPermissions(1, 2, req(owner), 's2');
      expect(permission.listRolePermissions.mock.calls).toEqual([
        ['s1', 0, 50],
        ['s2', 1, 2],
      ]);

      await expect(ctrl.getPermissionMatrix(req(school))).resolves.toEqual({
        matrix: { ADMIN: {}, TEACHER: {} },
        roles: ['ADMIN', 'TEACHER'],
      });
      await ctrl.getPermissionMatrix(req(owner), 's2');
      expect(permission.getPermissionMatrix.mock.calls).toEqual([['s1'], ['s2']]);
    });

    it('checks and revokes permissions', async () => {
      permission.checkPermission.mockResolvedValue(true);
      await expect(
        ctrl.checkPermission({ resource: 'r', action: 'READ' }, req(school)),
      ).resolves.toEqual({
        allowed: true,
        user: { id: 'o', role: 'OWNER' },
        resource: 'r',
        action: 'READ',
      });
      await ctrl.checkPermission({ resource: 'r', action: 'WRITE' }, req(owner), 's2');
      expect(permission.checkPermission.mock.calls.map((c: any) => c[0])).toEqual(['s1', 's2']);
      await ctrl.revokePermission('ADMIN', 'r', req(school));
      await ctrl.revokePermission('ADMIN', 'r', req({ role: 'OWNER' }), 's2');
      expect(permission.revokePermission.mock.calls).toEqual([
        ['s1', 'ADMIN', 'r', 'o'],
        ['s2', 'ADMIN', 'r', undefined],
      ]);
    });

    it('initializes default permissions for the target school', async () => {
      permission.createDefaultPermissions.mockResolvedValue([1, 2, 3]);
      await expect(ctrl.initializeDefaultPermissions(req(school))).resolves.toEqual({
        success: true,
        created: 3,
        permissions: [1, 2, 3],
      });
      await ctrl.initializeDefaultPermissions(req(owner), 's2');
      expect(permission.createDefaultPermissions.mock.calls).toEqual([['s1'], ['s2']]);
      expect(audit.log.mock.calls.map((c: any) => c[0].schoolId)).toEqual(['s1', 's2']);
      expect(audit.log.mock.calls[0][0]).toMatchObject({
        action: 'PERMISSIONS_INITIALIZED',
        newValues: { count: 3 },
      });
    });
  });

  describe('settings', () => {
    it('saves a setting with encryption default', async () => {
      await expect(
        ctrl.setSetting({ settingKey: 'k', settingValue: 'v' } as any, req()),
      ).resolves.toEqual({ success: true, message: 'Setting saved successfully', key: 'k' });
      await ctrl.setSetting(
        { settingKey: 'k', settingValue: 'v', isEncrypted: true, description: 'd' } as any,
        { ip: 'x' },
      );
      expect(settings.setSetting.mock.calls).toEqual([
        ['k', 'v', false, 'o', undefined],
        ['k', 'v', true, undefined, 'd'],
      ]);
    });

    it('reads a setting or fails', async () => {
      settings.getSetting.mockResolvedValueOnce({ key: 'k' });
      await expect(ctrl.getSetting('k')).resolves.toEqual({ key: 'k' });
      settings.getSetting.mockResolvedValueOnce(null);
      await expect(ctrl.getSetting('x')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lists, configures gateways and initializes defaults', async () => {
      await ctrl.listSettings();
      await ctrl.listSettings(3, 4);
      await ctrl.getSystemConfig();
      await ctrl.setPaymentGateway({ provider: 'MONCASH', apiKey: 'k', apiSecret: 's' }, req());
      await ctrl.setPaymentGateway({ provider: 'STRIPE', apiKey: 'k' }, { ip: 'x' });
      await ctrl.getPaymentGateway('EFI');
      settings.initializeDefaults.mockResolvedValue({ created: 4 });
      await expect(ctrl.initializeDefaultSettings(req())).resolves.toEqual({ created: 4 });
      await ctrl.initializeDefaultSettings({ ip: 'x' });

      expect(settings.listSettings.mock.calls).toEqual([
        [0, 50],
        [3, 4],
      ]);
      expect(settings.getSystemConfig).toHaveBeenCalled();
      expect(settings.validateGatewayConfig).toHaveBeenCalledWith('MONCASH', 'k');
      expect(settings.setPaymentGatewayConfig.mock.calls).toEqual([
        ['MONCASH', 'k', 's', 'o'],
        ['STRIPE', 'k', undefined, undefined],
      ]);
      expect(settings.getPaymentGatewayConfig).toHaveBeenCalledWith('EFI');
      expect(audit.log.mock.calls[0][0]).toMatchObject({
        action: 'SETTINGS_INITIALIZED',
        newValues: { count: 4 },
      });
    });
  });

  describe('audit logs', () => {
    it('queries logs and timelines with defaults', async () => {
      await ctrl.queryAuditLogs();
      await ctrl.queryAuditLogs('u', 'r', 'a', 1, 2);
      await ctrl.getUserActivityTimeline('u');
      await ctrl.getUserActivityTimeline('u', 7);
      await ctrl.detectSuspiciousActivity('u');
      await ctrl.detectSuspiciousActivity('u', 3);
      expect(audit.query.mock.calls).toEqual([
        [{ userId: undefined, resource: undefined, action: undefined, skip: 0, take: 50 }],
        [{ userId: 'u', resource: 'r', action: 'a', skip: 1, take: 2 }],
      ]);
      expect(audit.getUserActivityTimeline.mock.calls).toEqual([
        ['u', 30],
        ['u', 7],
      ]);
      expect(audit.detectSuspiciousActivity.mock.calls).toEqual([
        ['u', 1],
        ['u', 3],
      ]);
    });

    it('requires dates for summaries and compliance', async () => {
      await expect(ctrl.getActivitySummary('', '2026-01-02')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(ctrl.getActivitySummary('2026-01-01', '')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        ctrl.generateComplianceReport('', '2026-01-02'),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        ctrl.generateComplianceReport('2026-01-01', ''),
      ).rejects.toBeInstanceOf(BadRequestException);

      await ctrl.getActivitySummary('2026-01-01', '2026-01-02');
      await ctrl.generateComplianceReport('2026-01-01', '2026-01-02', 'School');
      expect(audit.getActivitySummary).toHaveBeenCalledWith(
        new Date('2026-01-01'),
        new Date('2026-01-02'),
      );
      expect(audit.generateComplianceReport).toHaveBeenCalledWith(
        new Date('2026-01-01'),
        new Date('2026-01-02'),
        'School',
      );
    });

    it('exports CSV with optional filters', async () => {
      await ctrl.exportAuditLogsCSV();
      await ctrl.exportAuditLogsCSV('2026-01-01');
      await ctrl.exportAuditLogsCSV('2026-01-01', '2026-01-02', 'School');
      expect(audit.exportToCSV.mock.calls).toEqual([
        [{}],
        [{}],
        [
          {
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-01-02'),
            resource: 'School',
          },
        ],
      ]);
    });
  });

  describe('metrics', () => {
    it('delegates every metric with defaults', async () => {
      await ctrl.getExecutiveDashboard();
      await ctrl.getTotalStudents();
      await ctrl.getTotalTeachers();
      await ctrl.getEnrollmentGrowth();
      await ctrl.getEnrollmentGrowth(6);
      await ctrl.getDefaultRate();
      await ctrl.getDefaultRate(10);
      await ctrl.getAttendanceStats();
      await ctrl.getAttendanceStats(5);
      await ctrl.getGradeDistribution();
      await ctrl.getEnrollmentByClass();
      await ctrl.getSchoolPerformance('s');
      await ctrl.getResourceUtilization('s');
      await ctrl.getAnalyticsSummary();

      expect(metrics.generateExecutiveDashboard).toHaveBeenCalled();
      expect(metrics.getTotalActiveStudents).toHaveBeenCalled();
      expect(metrics.getTotalActiveTeachers).toHaveBeenCalled();
      expect(metrics.getEnrollmentGrowth.mock.calls).toEqual([
        [undefined, 12],
        [undefined, 6],
      ]);
      expect(metrics.calculateDefaultRate.mock.calls).toEqual([
        [undefined, 30],
        [undefined, 10],
      ]);
      expect(metrics.getAttendanceStatistics.mock.calls).toEqual([
        [undefined, 30],
        [undefined, 5],
      ]);
      expect(metrics.getGradeDistribution).toHaveBeenCalled();
      expect(metrics.getEnrollmentByClass).toHaveBeenCalled();
      expect(metrics.getSchoolPerformanceMetrics).toHaveBeenCalledWith('s');
      expect(metrics.getResourceUtilization).toHaveBeenCalledWith('s');
      expect(owner.getAnalyticsSummary).toHaveBeenCalled();
    });
  });

  describe('schools', () => {
    it('creates a school, returns the admin account and audits without the password', async () => {
      const adminAccount = { email: 'a@x', emailSent: false, tempPassword: 'Tmp12345' };
      owner.createSchool.mockResolvedValue({ school: { id: 's1' }, adminAccount });
      await expect(ctrl.createSchool({ name: 'S', email: 'e' }, req())).resolves.toEqual({
        success: true,
        school: { id: 's1' },
        adminAccount,
        message: 'School created successfully',
      });
      expect(audit.log.mock.calls[0][0]).toMatchObject({
        userId: 'o',
        schoolId: 's1',
        action: 'CREATE',
        resourceId: 's1',
        newValues: { id: 's1', adminEmail: 'a@x' },
      });
      expect(JSON.stringify(audit.log.mock.calls[0][0])).not.toContain('Tmp12345');

      owner.createSchool.mockResolvedValue({ school: { id: 's2' }, adminAccount: null });
      await ctrl.createSchool({ name: 'S', email: 'e' }, { ...req(), user: undefined });
      expect(audit.log.mock.calls[1][0].newValues).toEqual({ id: 's2', adminEmail: null });
    });

    it('lists, features and permission codes', async () => {
      await ctrl.listSchools();
      await ctrl.getSchoolFeatures('s');
      await ctrl.updateSchoolFeatures('s', { enableFinance: true });
      await ctrl.listPermissionCodes('s');
      await ctrl.generatePermissionCode('s', { name: 'n', expiresIn: 3 });
      await ctrl.revokePermissionCode('c');
      expect(owner.listAllSchools).toHaveBeenCalled();
      expect(owner.getSchoolFeatures).toHaveBeenCalledWith('s');
      expect(owner.updateSchoolFeatures).toHaveBeenCalledWith('s', { enableFinance: true });
      expect(owner.listPermissionCodes).toHaveBeenCalledWith('s');
      expect(owner.generatePermissionCode).toHaveBeenCalledWith('s', { name: 'n', expiresIn: 3 });
      expect(owner.revokePermissionCode).toHaveBeenCalledWith('c');
    });

    it('updates and deletes a school with audit', async () => {
      owner.updateSchool.mockResolvedValue({ id: 's', name: 'New' });
      await expect(ctrl.updateSchool('s', { name: 'New' }, req())).resolves.toEqual({
        success: true,
        school: { id: 's', name: 'New' },
        message: 'School updated successfully',
      });
      await ctrl.updateSchool('s', {}, { ...req(), user: undefined });
      await expect(ctrl.deleteSchool('s', req())).resolves.toEqual({
        success: true,
        schoolId: 's',
        message: 'School deleted successfully',
      });
      await ctrl.deleteSchool('s', { ip: 'x' });
      expect(owner.deleteSchool).toHaveBeenCalledWith('s');
      expect(audit.log.mock.calls.map((c: any) => c[0].action)).toEqual([
        'UPDATE',
        'UPDATE',
        'DELETE',
        'DELETE',
      ]);
    });
  });

  it('reports health', async () => {
    await expect(ctrl.health()).resolves.toMatchObject({
      status: 'ok',
      service: 'Owner Control Panel',
    });
  });
});
