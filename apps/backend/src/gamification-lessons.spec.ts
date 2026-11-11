import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { AttendanceStatus, Role } from '@prisma/client';
import { createPrismaMock, PrismaMock } from './test-utils/prisma-mock';
import { GamificationService } from './gamification/gamification.service';
import { LessonsService } from './lessons/lessons.service';
import { ClassAccessService } from './prisma/class-access.service';

describe('GamificationService', () => {
  let prisma: PrismaMock;
  let svc: GamificationService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new GamificationService(prisma as any);
  });

  const due = new Date('2026-02-01');
  const early = { submittedAt: new Date('2026-01-01'), assignment: { classId: 'c', dueDate: due } };
  const late = { submittedAt: new Date('2026-03-01'), assignment: { classId: 'c', dueDate: due } };

  it('summarizes an empty student', async () => {
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.assignmentSubmission.findMany.mockResolvedValue([]);
    expect(await svc.getStudentSummary('s')).toEqual({
      points: 0,
      attendancePoints: 0,
      assignmentPoints: 0,
      perfectAttendanceClasses: 0,
      earlySubmissions: 0,
      attendanceRate: 0,
      badges: [],
    });
    expect(prisma.attendance.findMany.mock.calls[0][0].where).toEqual({ studentId: 's' });
  });

  it('awards points and every badge', async () => {
    prisma.attendance.findMany.mockResolvedValue([
      { classId: 'c1', status: AttendanceStatus.PRESENT },
      { classId: 'c1', status: AttendanceStatus.PRESENT },
      { classId: 'c2', status: AttendanceStatus.PRESENT },
    ]);
    prisma.assignmentSubmission.findMany.mockResolvedValue([early, early, early, late]);
    const r = await svc.getStudentSummary('s');
    expect(r).toMatchObject({
      perfectAttendanceClasses: 2,
      earlySubmissions: 3,
      attendancePoints: 200,
      assignmentPoints: 60,
      points: 260,
      attendanceRate: 100,
    });
    expect(r.badges.map((b) => b.code)).toEqual(['PERFECT_ATTENDANCE', 'EARLY_SUBMITTER', 'CONSISTENT']);
  });

  it('does not reward classes with absences', async () => {
    prisma.attendance.findMany.mockResolvedValue([
      { classId: 'c1', status: AttendanceStatus.ABSENT },
      { classId: 'c1', status: AttendanceStatus.LATE },
    ]);
    prisma.assignmentSubmission.findMany.mockResolvedValue([late]);
    const r = await svc.getStudentSummary('s');
    expect(r).toMatchObject({ perfectAttendanceClasses: 0, attendanceRate: 0, points: 0 });
    expect(r.badges).toEqual([]);
  });

  describe('getClassLeaderboard', () => {
    it('throws for unknown classes', async () => {
      prisma.class.findUnique.mockResolvedValue(null);
      await expect(svc.getClassLeaderboard('c', { id: 'a', role: Role.ADMIN })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('forbids teachers of other classes', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'c', name: 'C', teacherId: 't1', students: [] });
      await expect(svc.getClassLeaderboard('c', { id: 't2', role: Role.TEACHER })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('ranks students by points', async () => {
      prisma.class.findUnique.mockResolvedValue({
        id: 'c',
        name: 'C',
        teacherId: null,
        students: [
          { id: 'low', name: 'L', email: 'l' },
          { id: 'high', name: 'H', email: 'h' },
        ],
      });
      prisma.attendance.findMany.mockImplementation(async (args: any) =>
        args.where.studentId === 'high' ? [{ classId: 'c', status: AttendanceStatus.PRESENT }] : [],
      );
      prisma.assignmentSubmission.findMany.mockResolvedValue([]);
      const r = await svc.getClassLeaderboard('c', { id: 't', role: Role.TEACHER });
      expect(r.leaderboard.map((x) => x.student.id)).toEqual(['high', 'low']);
      expect(prisma.attendance.findMany.mock.calls[0][0].where).toEqual({ studentId: 'low', classId: 'c' });
      expect(prisma.assignmentSubmission.findMany.mock.calls[0][0].where).toEqual({
        studentId: 'low',
        assignment: { classId: 'c' },
      });

      prisma.class.findUnique.mockResolvedValue({ id: 'c', name: 'C', teacherId: 't', students: [] });
      await expect(svc.getClassLeaderboard('c', { id: 't', role: Role.TEACHER })).resolves.toMatchObject({
        leaderboard: [],
      });
    });
  });
});

describe('LessonsService', () => {
  let prisma: PrismaMock;
  let svc: LessonsService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new LessonsService(prisma as any, new ClassAccessService(prisma as any));
  });

  describe('createPlan', () => {
    const payload = { classId: 'c', date: '2026-01-01', title: 'Plan' };

    it('validates content, class, ownership and school', async () => {
      await expect(svc.createPlan({ ...payload, title: ' ' }, { sub: 't', role: Role.TEACHER })).rejects.toThrow(
        'title and date are required',
      );
      await expect(svc.createPlan({ ...payload, date: '' }, { sub: 't', role: Role.TEACHER })).rejects.toThrow(
        'title and date are required',
      );
      prisma.class.findUnique.mockResolvedValueOnce(null);
      await expect(svc.createPlan(payload, { sub: 't', role: Role.TEACHER })).rejects.toBeInstanceOf(NotFoundException);
      // A class without a teacher is not open to every teacher on the platform.
      prisma.class.findUnique.mockResolvedValueOnce({ id: 'c', teacherId: null, academicYear: { schoolId: 's' } });
      await expect(svc.createPlan(payload, { sub: 't', role: Role.TEACHER })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      prisma.class.findUnique.mockResolvedValueOnce({ id: 'c', teacherId: 'other', academicYear: { schoolId: 's' } });
      await expect(svc.createPlan(payload, { sub: 't', role: Role.TEACHER })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      prisma.class.findUnique.mockResolvedValueOnce({ id: 'c', teacherId: 't', academicYear: { schoolId: 's' } });
      await expect(
        svc.createPlan(payload, { sub: 'a', role: Role.ADMIN, schoolId: 'other-school' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('stores defaults and returns the parsed plan', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'c', teacherId: 't', academicYear: { schoolId: 's' } });
      prisma.auditLog.create.mockImplementation(async (args: any) => ({
        id: 'p1',
        createdAt: new Date('2026-01-01'),
        userId: args.data.userId,
        changes: args.data.changes,
      }));
      const r = await svc.createPlan({ ...payload, title: ' Plan ' }, { sub: 't', role: Role.TEACHER });
      expect(r).toMatchObject({
        id: 'p1',
        classId: 'c',
        schoolId: 's',
        title: 'Plan',
        visibility: 'SCHOOL',
        tags: [],
        objectives: undefined,
        createdById: 't',
      });

      const full = await svc.createPlan(
        {
          ...payload,
          objectives: 'o',
          content: 'c',
          methodology: 'm',
          visibility: 'CLASS',
          tags: ['math'],
        },
        { sub: 'a', role: Role.ADMIN, schoolId: 's' },
      );
      expect(full).toMatchObject({ objectives: 'o', content: 'c', methodology: 'm', visibility: 'CLASS', tags: ['math'], createdById: 'a' });
    });
  });

  describe('listByClass', () => {
    it('lists plans with authors when present', async () => {
      prisma.auditLog.findMany.mockResolvedValueOnce([
        { id: '1', createdAt: new Date(), userId: 'u1', changes: { classId: 'c', title: 'A', date: 'd' } },
        { id: '2', createdAt: new Date(), userId: null, changes: 'not-json' },
        { id: '3', createdAt: new Date(), userId: 'ghost', changes: null },
      ]);
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'u1', name: 'T', email: 'e' }]);
      const r = await svc.listByClass('c');
      expect(r[0]).toMatchObject({ title: 'A', createdBy: { id: 'u1' } });
      expect(r[1]).toMatchObject({ title: '', createdBy: null });
      expect(r[2]).toMatchObject({ createdBy: null, classId: '' });
    });

    it('skips user lookup without authors', async () => {
      prisma.auditLog.findMany.mockResolvedValueOnce([]);
      expect(await svc.listByClass('c')).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('listRepository', () => {
    const rows = [
      {
        id: '1',
        createdAt: new Date(),
        userId: 't1',
        changes: { classId: 'c1', schoolId: 's1', title: 'Fractions', tags: ['Math', 7] },
      },
      {
        id: '2',
        createdAt: new Date(),
        userId: null,
        changes: { classId: 'c2', schoolId: 's2', title: 'Poems', content: 'verse', objectives: 'read', methodology: 'group' },
      },
    ];

    it('filters by school and query and resolves classes/teachers', async () => {
      prisma.auditLog.findMany.mockResolvedValue(rows);
      prisma.class.findMany.mockResolvedValue([{ id: 'c1', name: '3e' }]);
      prisma.user.findMany.mockResolvedValue([{ id: 't1', name: 'T' }]);

      const all = await svc.listRepository({ classId: 'c1', teacherId: 't1' });
      expect(prisma.auditLog.findMany.mock.calls[0][0].where).toMatchObject({ entityId: 'c1', userId: 't1' });
      expect(all[0]).toMatchObject({ class: { id: 'c1' }, createdBy: { id: 't1' }, tags: ['Math', '7'] });
      expect(all[1]).toMatchObject({ class: null, createdBy: null });

      expect((await svc.listRepository({ schoolId: 's1' })).map((r) => r.id)).toEqual(['1']);
      expect((await svc.listRepository({ query: 'MATH' })).map((r) => r.id)).toEqual(['1']);
      expect((await svc.listRepository({ query: 'verse' })).map((r) => r.id)).toEqual(['2']);
    });

    it('hides CLASS plans of other classes unless the viewer wrote them', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        { id: 'shared', createdAt: new Date(), userId: 'x', changes: { classId: 'c1', schoolId: 's', title: 'A', visibility: 'SCHOOL' } },
        { id: 'mine', createdAt: new Date(), userId: 'me', changes: { classId: 'c1', schoolId: 's', title: 'B', visibility: 'CLASS' } },
        { id: 'private', createdAt: new Date(), userId: 'x', changes: { classId: 'c1', schoolId: 's', title: 'C', visibility: 'CLASS' } },
      ]);
      prisma.class.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      expect((await svc.listRepository({ schoolId: 's', viewerId: 'me' })).map((r) => r.id)).toEqual(['shared', 'mine']);
      expect((await svc.listRepository({ schoolId: 's', viewerId: 'me', classId: 'c1' })).map((r) => r.id)).toEqual([
        'shared',
        'mine',
        'private',
      ]);
    });

    it('skips lookups when nothing matches', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      expect(await svc.listRepository({})).toEqual([]);
      expect(prisma.class.findMany).not.toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });
});
