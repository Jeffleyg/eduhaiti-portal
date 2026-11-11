import { ForbiddenException, StreamableFile } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, jest } from '@jest/globals';
import { Role } from '@prisma/client';
import { autoMock } from '../test-utils/auto-mock';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { AnalyticsController } from './analytics.controller';

const admin = { user: { sub: 'adm', role: Role.ADMIN, schoolId: 'school-a' } };
const owner = { user: { sub: 'own', role: Role.OWNER, schoolId: null } };
const orphanAdmin = { user: { sub: 'x', role: Role.ADMIN, schoolId: null } };

describe('AnalyticsController security', () => {
  it('requires a JWT and the ADMIN or OWNER role', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AnalyticsController)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, AnalyticsController)).toEqual([Role.ADMIN, Role.OWNER]);
    expect(
      Reflect.getMetadata(ROLES_KEY, AnalyticsController.prototype.getSqlServerViewLocation),
    ).toEqual([Role.OWNER]);
  });

  it('pins admins to their own school whatever they request', async () => {
    const svc = autoMock();
    const ctrl = new AnalyticsController(svc as any);

    await ctrl.getDiasporaImpact(admin as any, 'school-b');
    await ctrl.getEarlyWarning(admin as any, 'school-b');
    await ctrl.getReport(admin as any, 'evasao-escolar', 'school-b');

    expect(svc.getDiasporaScholarshipImpactDashboard).toHaveBeenCalledWith('school-a');
    expect(svc.getEarlyWarningReport).toHaveBeenCalledWith('school-a');
    expect(svc.buildReportData).toHaveBeenCalledWith('evasao-escolar', 'school-a');
  });

  it('lets the owner choose a school or the whole platform', async () => {
    const svc = autoMock();
    const ctrl = new AnalyticsController(svc as any);

    await ctrl.getReport(owner as any, 'evasao-escolar', 'school-b');
    expect(svc.buildReportData).toHaveBeenLastCalledWith('evasao-escolar', 'school-b');
    await ctrl.getReport(owner as any, 'media-notas-regiao');
    expect(svc.buildReportData).toHaveBeenLastCalledWith('media-notas-regiao', undefined);
  });

  it('rejects admins without a school and cross-school reports for admins', async () => {
    const ctrl = new AnalyticsController(autoMock() as any);
    await expect(ctrl.getEarlyWarning(orphanAdmin as any)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctrl.getReport(admin as any, 'media-notas-regiao')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      ctrl.exportReport(admin as any, 'media-notas-regiao', {} as any, { setHeader: jest.fn() } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AnalyticsController', () => {
  it('returns the SQL view location', () => {
    const ctrl = new AnalyticsController(autoMock() as any);
    expect(ctrl.getSqlServerViewLocation().file).toContain('analytics_views.sql');
  });

  it('reads the early warning report without side effects', async () => {
    const svc = autoMock();
    const ctrl = new AnalyticsController(svc as any);
    await expect(ctrl.getEarlyWarning(admin as any)).resolves.toEqual({
      report: { mocked: 'getEarlyWarningReport' },
    });
    expect(svc.triggerEarlyWarningAlerts).not.toHaveBeenCalled();
  });

  it('triggers alerts in the caller school on behalf of the caller', async () => {
    const svc = autoMock();
    const ctrl = new AnalyticsController(svc as any);
    await expect(ctrl.triggerEarlyWarning(admin as any, 'school-b')).resolves.toEqual({
      report: { mocked: 'getEarlyWarningReport' },
      notification: { mocked: 'triggerEarlyWarningAlerts' },
    });
    expect(svc.triggerEarlyWarningAlerts).toHaveBeenCalledWith('school-a', 'adm', {
      mocked: 'getEarlyWarningReport',
    });
  });

  it('exports reports with headers and a default format', async () => {
    const svc = autoMock();
    svc.exportReport.mockResolvedValue({
      contentType: 'application/gzip',
      fileName: 'r.json.gz',
      buffer: Buffer.from('abc'),
    });
    const ctrl = new AnalyticsController(svc as any);
    const res = { setHeader: jest.fn() };

    const file = await ctrl.exportReport(
      owner as any,
      'evasao-escolar',
      { schoolId: 's', format: 'nope' } as any,
      res as any,
    );
    expect(file).toBeInstanceOf(StreamableFile);
    expect(svc.exportReport).toHaveBeenLastCalledWith('evasao-escolar', 's', 'json.gz');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', '3');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="r.json.gz"');

    await ctrl.exportReport(admin as any, 'evasao-escolar', { format: 'csv' } as any, res as any);
    expect(svc.exportReport).toHaveBeenLastCalledWith('evasao-escolar', 'school-a', 'csv');
  });
});
