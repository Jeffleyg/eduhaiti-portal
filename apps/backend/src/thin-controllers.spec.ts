import { describe, expect, it, jest } from '@jest/globals';
import { Role } from '@prisma/client';
import { autoMock } from './test-utils/auto-mock';
import { createPrismaMock } from './test-utils/prisma-mock';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { OwnerAuthController } from './owner/owner-auth.controller';
import { DisciplinesPublicController } from './disciplines/disciplines.public.controller';
import { ScorecardsController } from './scorecards/scorecards.controller';
import { HybridAuditService } from './hybrid-gateway/services/hybrid-audit.service';

describe('AppService', () => {
  it('returns health payload', () => {
    expect(new AppService().getHealth()).toEqual({
      status: 'ok',
      service: 'backend-api',
      timestamp: expect.any(String),
    });
  });
});

describe('HealthController', () => {
  it('delegates to HealthService.check', async () => {
    const svc = autoMock();
    await expect(new HealthController(svc as any).getHealth()).resolves.toEqual({
      mocked: 'check',
    });
  });
});

describe('OwnerAuthController', () => {
  it('verifies the permission code', async () => {
    const svc = autoMock();
    const ctrl = new OwnerAuthController(svc as any);
    await ctrl.verifyPermissionCode({ code: 'C', email: 'e', name: 'n' });
    expect(svc.verifyPermissionCode).toHaveBeenCalledWith('C', 'e', 'n');
  });
});

describe('DisciplinesPublicController', () => {
  it('finds by series', async () => {
    const svc = autoMock();
    const access = autoMock();
    const req = { user: { sub: 't', role: Role.TEACHER, schoolId: 'sc' } };
    await new DisciplinesPublicController(svc as any, access as any).findBySeries(req, 'se1');
    expect(access.assertSeriesInSchool).toHaveBeenCalledWith('se1', req.user);
    expect(svc.findBySeries).toHaveBeenCalledWith('se1');
  });
});

describe('ScorecardsController', () => {
  it('verifies public and private scorecards', async () => {
    const svc = autoMock();
    const ctrl = new ScorecardsController(svc as any);
    await ctrl.verifyPublic('a');
    await ctrl.verifyPrivate('b');
    expect(svc.verifyPublicScorecard).toHaveBeenNthCalledWith(1, 'a');
    expect(svc.verifyPublicScorecard).toHaveBeenNthCalledWith(2, 'b');
  });
});

describe('HybridAuditService', () => {
  it('logs with studentId, requestId or a random id', async () => {
    const prisma = createPrismaMock();
    const svc = new HybridAuditService(prisma as any);
    const base = { channel: 'sms' as const, senderPhone: '509', command: 'NOT' };

    await svc.logMessageQuery({ ...base, status: 'ok', studentId: 'st1' });
    await svc.logMessageQuery({ ...base, status: 'denied', requestId: 'r1' });
    await svc.logMessageQuery({ ...base, status: 'invalid' });

    const calls = prisma.auditLog.create.mock.calls.map((c: any) => c[0].data);
    expect(calls[0]).toMatchObject({ resourceId: 'st1', action: 'OK' });
    expect(calls[1]).toMatchObject({ resourceId: 'r1', action: 'DENIED' });
    expect(calls[2].resourceId).toEqual(expect.any(String));
    expect(calls[2].action).toBe('INVALID');
  });
});

void jest;
