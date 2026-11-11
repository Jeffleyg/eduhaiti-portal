import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { Role } from '@prisma/client';
import { autoMock, httpContext } from './test-utils/auto-mock';
import { SyncController } from './sync/sync.controller';
import { AcademicSettingsController } from './academic-settings/academic-settings.controller';
import { GamificationController } from './gamification/gamification.controller';
import { ClassesPublicController } from './classes/classes.public.controller';
import { HybridGatewayController } from './hybrid-gateway/hybrid-gateway.controller';
import { UsersController } from './users/users.controller';
import { Idempotent } from './finance-integration/decorators/idempotent.decorator';
import { AdminGuard, SuperAdminGuard } from './owner/guards/super-admin.guard';
import { GradesPublicController } from './grades/grades.public.controller';
import { CommandParserService } from './hybrid-gateway/services/command-parser.service';
import { AttendancePublicController } from './attendance/attendance.public.controller';
import { LessonsController } from './lessons/lessons.controller';

describe('SyncController', () => {
  it('passes the sync context to the service', async () => {
    const svc = autoMock();
    const ctrl = new SyncController(svc as any);
    const req: any = { syncContext: { userId: 'u' } };
    await ctrl.push(req, { a: 1 } as any);
    await ctrl.pull(req, { b: 2 } as any);
    expect(svc.push).toHaveBeenCalledWith({ a: 1 }, req.syncContext);
    expect(svc.pull).toHaveBeenCalledWith({ b: 2 }, req.syncContext);
  });
});

describe('AcademicSettingsController', () => {
  it('gets and upserts settings', async () => {
    const svc = autoMock();
    const ctrl = new AcademicSettingsController(svc as any);
    await ctrl.getBySchool('s1');
    await ctrl.upsertBySchool('s1', { x: 1 } as any);
    expect(svc.getBySchool).toHaveBeenCalledWith('s1');
    expect(svc.upsertBySchool).toHaveBeenCalledWith('s1', { x: 1 });
  });
});

describe('GamificationController', () => {
  it('returns the student summary (with and without user)', async () => {
    const svc = autoMock();
    const ctrl = new GamificationController(svc as any, autoMock() as any);
    await ctrl.me({ user: { sub: 'st' } });
    await ctrl.me({});
    expect(svc.getStudentSummary).toHaveBeenNthCalledWith(1, 'st');
    expect(svc.getStudentSummary).toHaveBeenNthCalledWith(2, '');
  });

  it('checks class access before the leaderboard', async () => {
    const svc = autoMock();
    const access = autoMock();
    const ctrl = new GamificationController(svc as any, access as any);
    const user = { sub: 't', role: Role.ADMIN };
    await ctrl.classLeaderboard({ user }, 'c1');
    await ctrl.classLeaderboard({}, 'c2');
    expect(access.assertCanManageClass).toHaveBeenCalledWith('c1', user);
    expect(svc.getClassLeaderboard).toHaveBeenNthCalledWith(1, 'c1', {
      id: 't',
      role: Role.ADMIN,
    });
    expect(svc.getClassLeaderboard).toHaveBeenNthCalledWith(2, 'c2', {
      id: '',
      role: Role.TEACHER,
    });
  });
});

describe('ClassesPublicController', () => {
  const admin = { user: { sub: 'a', role: Role.ADMIN, schoolId: 'sc' } };

  it('routes my-classes by role and scopes admins to their school', async () => {
    const svc = autoMock();
    const ctrl = new ClassesPublicController(svc as any, autoMock() as any);
    await ctrl.getMyClasses({ user: { sub: 't', role: Role.TEACHER } });
    await ctrl.getMyClasses({ user: { role: Role.TEACHER } });
    await ctrl.getMyClasses({ user: { sub: 's', role: Role.STUDENT } });
    await ctrl.getMyClasses({ user: { role: Role.STUDENT } });
    await ctrl.getMyClasses(admin);
    await ctrl.getMyClasses({ user: { sub: 'o', role: Role.OWNER } });
    expect(svc.findByTeacher.mock.calls).toEqual([['t'], ['']]);
    expect(svc.findByStudent.mock.calls).toEqual([['s'], ['']]);
    expect(svc.findAll.mock.calls).toEqual([
      [undefined, undefined, 'sc'],
      [undefined, undefined, undefined],
    ]);
    await expect(ctrl.getMyClasses({})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctrl.getMyClasses({ user: { sub: 'x', role: Role.ADMIN } })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("lists the caller's school only and gives students their own classes", async () => {
    const svc = autoMock();
    const ctrl = new ClassesPublicController(svc as any, autoMock() as any);
    await ctrl.getAllClasses(admin, 'y', 's');
    expect(svc.findAll).toHaveBeenCalledWith('y', 's', 'sc');
    await ctrl.getAllClasses({ user: { sub: 'st', role: Role.STUDENT } }, 'y');
    await ctrl.getAllClasses({ user: { role: Role.STUDENT } });
    expect(svc.findByStudent.mock.calls).toEqual([['st'], ['']]);
    expect(svc.findAll).toHaveBeenCalledTimes(1);
  });

  it('returns the summary for teachers only', async () => {
    const svc = autoMock();
    const ctrl = new ClassesPublicController(svc as any, autoMock() as any);
    await ctrl.getMySummary({ user: { sub: 't', role: Role.TEACHER } });
    await ctrl.getMySummary({ user: { role: Role.TEACHER } });
    expect(svc.getTeacherSummary.mock.calls).toEqual([['t'], ['']]);
    await expect(ctrl.getMySummary(admin)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctrl.getMySummary({})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('checks access before returning one class', async () => {
    const svc = autoMock();
    const access = autoMock();
    const ctrl = new ClassesPublicController(svc as any, access as any);
    await ctrl.getClass(admin, 'c1');
    expect(access.assertCanViewClass).toHaveBeenCalledWith('c1', admin.user);
    expect(svc.findById).toHaveBeenCalledWith('c1');
    access.assertCanViewClass.mockRejectedValueOnce(new ForbiddenException());
    await expect(ctrl.getClass(admin, 'c2')).rejects.toBeInstanceOf(ForbiddenException);
    expect(svc.findById).toHaveBeenCalledTimes(1);
  });
});

describe('HybridGatewayController', () => {
  it('delegates every channel', async () => {
    const svc = autoMock();
    const ctrl = new HybridGatewayController(svc as any);
    const dto: any = { operator: 'digicel', payload: { a: 1 } };
    const ivr = { studentId: 's', senderPhone: 'p' };
    await ctrl.receiveSms(dto);
    await ctrl.receiveUssd(dto);
    await ctrl.ivrSummary(ivr);
    await ctrl.ivrLessonSummary(ivr);
    expect(svc.handleSms).toHaveBeenCalledWith('digicel', { a: 1 });
    expect(svc.handleUssd).toHaveBeenCalledWith('digicel', { a: 1 });
    expect(svc.buildIvrSummary).toHaveBeenCalledWith(ivr);
    expect(svc.buildIvrLessonSummary).toHaveBeenCalledWith(ivr);
  });
});

describe('UsersController', () => {
  it('scopes every call to the admin school and refuses admins without one', async () => {
    const svc = autoMock();
    const guardians = autoMock();
    const ctrl = new UsersController(svc as any, guardians as any);
    const req = { user: { schoolId: 's1' } };
    await ctrl.findAllStudents(req);
    await ctrl.findAllTeachers(req);
    await ctrl.createStudent(req, { email: 'a' } as any);
    await ctrl.createTeacher(req, { email: 'b' } as any);
    await ctrl.resendTempPassword(req, { email: 'c' } as any);
    expect(svc.findAllStudents).toHaveBeenCalledWith('s1');
    expect(svc.findAllTeachers).toHaveBeenCalledWith('s1');
    expect(svc.createStudent).toHaveBeenCalledWith({ email: 'a' }, 's1');
    expect(svc.createTeacher).toHaveBeenCalledWith({ email: 'b' }, 's1');
    expect(svc.resendTempPassword).toHaveBeenCalledWith('c', 's1');
    expect(() => ctrl.findAllTeachers({})).toThrow(ForbiddenException);
  });

  it('reads and replaces guardians of students of the same school', async () => {
    const guardians = autoMock();
    const ctrl = new UsersController(autoMock() as any, guardians as any);
    const req = { user: { schoolId: 's1' } };
    const body = { guardians: [{ fullName: 'Jean', phoneNumber: '37123456', relationship: 'FATHER' as const }] };
    await ctrl.listGuardians(req, 'st');
    await ctrl.replaceGuardians(req, 'st', body);
    expect(guardians.assertStudentInSchool.mock.calls).toEqual([
      ['st', 's1'],
      ['st', 's1'],
    ]);
    expect(guardians.listForStudent).toHaveBeenCalledWith('st');
    expect(guardians.replaceForStudent).toHaveBeenCalledWith('st', body.guardians);

    guardians.assertStudentInSchool.mockRejectedValueOnce(new ForbiddenException());
    await expect(ctrl.replaceGuardians(req, 'other', body)).rejects.toBeInstanceOf(ForbiddenException);
    expect(guardians.replaceForStudent).toHaveBeenCalledTimes(1);
  });
});

describe('Idempotent decorator', () => {
  class Target {
    constructor(public idempotencyService?: any) {}

    @Idempotent({ operation: 'op', keyFromArgs: (k) => k as string })
    async run(key: string, tx?: unknown) {
      return { key, tx };
    }
  }

  it('calls the original method when no service is present', async () => {
    await expect(new Target().run('k')).resolves.toEqual({ key: 'k', tx: undefined });
  });

  it('rejects blank keys', async () => {
    const t = new Target({ executeWithIdempotency: jest.fn() });
    await expect(t.run('  ')).rejects.toBeInstanceOf(BadRequestException);
    await expect(t.run('')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('wraps the call with the idempotency service and passes tx', async () => {
    const svc = {
      executeWithIdempotency: jest.fn(
        async (_k: string, _op: string, fn: (tx: unknown) => unknown) => fn('TX'),
      ),
    };
    const t = new Target(svc);
    await expect(t.run('k1')).resolves.toEqual({ key: 'k1', tx: 'TX' });
    expect(svc.executeWithIdempotency).toHaveBeenCalledWith(
      'k1',
      'op',
      expect.any(Function),
    );
  });
});

describe('owner guards', () => {
  it('SuperAdminGuard allows only OWNER', () => {
    const g = new SuperAdminGuard();
    expect(() => g.canActivate(httpContext({}))).toThrow(ForbiddenException);
    expect(() => g.canActivate(httpContext({ user: { role: 'ADMIN' } }))).toThrow(
      ForbiddenException,
    );
    expect(g.canActivate(httpContext({ user: { role: 'OWNER' } }))).toBe(true);
  });

  it('AdminGuard allows OWNER and ADMIN', () => {
    const g = new AdminGuard();
    expect(() => g.canActivate(httpContext({}))).toThrow(ForbiddenException);
    expect(() =>
      g.canActivate(httpContext({ user: { role: 'TEACHER' } })),
    ).toThrow(ForbiddenException);
    expect(g.canActivate(httpContext({ user: { role: 'OWNER' } }))).toBe(true);
    expect(g.canActivate(httpContext({ user: { role: 'ADMIN' } }))).toBe(true);
  });
});

describe('GradesPublicController', () => {
  it('uses the authenticated student id (or empty)', async () => {
    const svc = autoMock();
    const access = autoMock();
    const ctrl = new GradesPublicController(svc as any, access as any);
    const req = { user: { sub: 'st' } };
    await ctrl.getMyGrades(req, 'y');
    await ctrl.getMyGrades({});
    await ctrl.getStudentReport(req, 'y');
    await ctrl.getStudentReport({}, 'y');
    await ctrl.getMyAcademicYears(req);
    await ctrl.getMyAcademicYears({});
    await ctrl.getMyEvolution(req, 'y');
    await ctrl.getMyEvolution({});
    await ctrl.getClassGrades(req, 'c', 'd');
    expect(svc.findByStudent.mock.calls).toEqual([['st', 'y'], ['', undefined]]);
    expect(svc.getStudentReport.mock.calls).toEqual([['st', 'y'], ['', 'y']]);
    expect(svc.listAcademicYearsForStudent.mock.calls).toEqual([['st'], ['']]);
    expect(svc.getStudentEvolution.mock.calls).toEqual([['st', 'y'], ['', undefined]]);
    expect(svc.findByClass).toHaveBeenCalledWith('c', 'd');
    expect(access.assertCanManageClass).toHaveBeenCalledWith('c', req.user);
  });

  it('lets only students issue their own transcript', async () => {
    const svc = autoMock();
    const ctrl = new GradesPublicController(svc as any, autoMock() as any);
    await ctrl.issueTranscript({ user: { sub: 'st', role: Role.STUDENT } }, 'y');
    expect(svc.issueTranscript).toHaveBeenCalledWith('st', 'y');
    await expect(ctrl.issueTranscript({ user: { sub: 't', role: Role.TEACHER } }, 'y')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(ctrl.issueTranscript({ user: { role: Role.STUDENT } }, 'y')).rejects.toBeInstanceOf(ForbiddenException);
    expect(svc.issueTranscript).toHaveBeenCalledTimes(1);
  });
});

describe('CommandParserService', () => {
  const p = new CommandParserService();

  it('defaults to help', () => {
    expect(p.parse('   ')).toEqual({ type: 'AJUDA' });
    expect(p.parse('xyz')).toEqual({ type: 'AJUDA' });
    expect(p.parse('ede')).toEqual({ type: 'AJUDA' });
  });

  it('parses grade and attendance commands with aliases', () => {
    expect(p.parse(' nota  s1 d1 123 ')).toEqual({
      type: 'NOTA',
      studentId: 'S1',
      responsibleDocumentId: 'D1',
      otpCode: '123',
    });
    expect(p.parse('not s1').type).toBe('NOTA');
    expect(p.parse('prezans s1').type).toBe('FREQ');
    expect(p.parse('FREQ s1').type).toBe('FREQ');
  });

  it('parses notices', () => {
    expect(p.parse('avi s1 d1 9')).toEqual({
      type: 'AVISO',
      studentId: 'S1',
      responsibleDocumentId: 'D1',
      otpCode: '9',
    });
  });
});

describe('AttendancePublicController', () => {
  it('parses optional dates', async () => {
    const svc = autoMock();
    const access = autoMock();
    const ctrl = new AttendancePublicController(svc as any, access as any);
    const t = { user: { sub: 't', role: Role.TEACHER } };
    await ctrl.getMyAttendance({ user: { sub: 'st' } }, '2026-01-01', '2026-02-01');
    await ctrl.getMyAttendance({});
    await ctrl.getMyStats({ user: { sub: 'st' } }, 'c');
    await ctrl.getMyStats({}, 'c');
    await ctrl.getClassAttendance(t, 'c', '2026-01-05');
    await ctrl.getClassAttendance(t, 'c');
    await ctrl.getClassReport(t, 'c');

    expect(svc.findByStudent.mock.calls[0]).toEqual([
      'st',
      new Date('2026-01-01'),
      new Date('2026-02-01'),
    ]);
    expect(svc.findByStudent.mock.calls[1]).toEqual(['', undefined, undefined]);
    expect(svc.getStudentAttendanceStats.mock.calls).toEqual([
      ['st', 'c'],
      ['', 'c'],
    ]);
    expect(svc.findByClass.mock.calls).toEqual([
      ['c', new Date('2026-01-05')],
      ['c', undefined],
    ]);
    expect(svc.getClassAttendanceReport).toHaveBeenCalledWith('c');
    expect(access.assertCanManageClass).toHaveBeenCalledTimes(3);
    expect(access.assertCanManageClass).toHaveBeenCalledWith('c', t.user);
  });
});

describe('LessonsController', () => {
  const teacher = { user: { sub: 't', role: Role.TEACHER, schoolId: 's' } };

  it('checks class access before listing a class', async () => {
    const svc = autoMock();
    const access = autoMock();
    const ctrl = new LessonsController(svc as any, access as any);
    await expect(ctrl.listByClass(teacher)).resolves.toEqual([]);
    await ctrl.listByClass(teacher, 'c');
    expect(access.assertCanViewClass).toHaveBeenCalledWith('c', teacher.user);
    expect(svc.listByClass).toHaveBeenCalledWith('c');

    access.assertCanViewClass.mockRejectedValueOnce(new ForbiddenException());
    await expect(ctrl.listByClass(teacher, 'other')).rejects.toBeInstanceOf(ForbiddenException);
    expect(svc.listByClass).toHaveBeenCalledTimes(1);
  });

  it("scopes the repository to the caller's school", async () => {
    const svc = autoMock();
    const access = autoMock();
    const ctrl = new LessonsController(svc as any, access as any);

    await ctrl.listRepository(teacher, 'c', 'q');
    expect(access.assertCanViewClass).toHaveBeenCalledWith('c', teacher.user);
    expect(svc.listRepository).toHaveBeenLastCalledWith({ classId: 'c', query: 'q', schoolId: 's', viewerId: 't' });

    await ctrl.listRepository({ user: { sub: 'o', role: Role.OWNER } });
    expect(svc.listRepository).toHaveBeenLastCalledWith({ classId: undefined, query: undefined, schoolId: undefined, viewerId: 'o' });
    expect(access.assertCanViewClass).toHaveBeenCalledTimes(1);

    await expect(ctrl.listRepository({ user: { sub: 'a', role: Role.ADMIN } })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctrl.listRepository({})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a plan as the current user', async () => {
    const svc = autoMock();
    const ctrl = new LessonsController(svc as any, autoMock() as any);
    const body: any = { classId: 'c', date: 'd', title: 't' };
    await ctrl.create(teacher, body);
    await ctrl.create({}, body);
    expect(svc.createPlan.mock.calls).toEqual([
      [body, teacher.user],
      [body, {}],
    ]);
  });
});
