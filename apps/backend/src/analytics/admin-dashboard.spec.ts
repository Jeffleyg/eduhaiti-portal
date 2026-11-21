import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { AdminDashboardService, startOfWeek } from './admin-dashboard.service';
import { AdminDashboardController } from './admin-dashboard.controller';

const NOW = new Date('2026-11-21T12:00:00Z'); // a Saturday
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe('startOfWeek', () => {
  it('returns the Monday of the week, in UTC', () => {
    expect(startOfWeek(NOW).toISOString()).toBe('2026-11-16T00:00:00.000Z');
    expect(startOfWeek(new Date('2026-11-16T08:00:00Z')).toISOString()).toBe(
      '2026-11-16T00:00:00.000Z',
    );
    expect(startOfWeek(new Date('2026-11-22T23:00:00Z')).toISOString()).toBe(
      '2026-11-16T00:00:00.000Z',
    );
  });
});

describe('AdminDashboardService', () => {
  let prisma: PrismaMock;
  let analytics: {
    getEarlyWarningReport: jest.Mock<(...a: any[]) => Promise<any[]>>;
  };
  let svc: AdminDashboardService;

  beforeEach(() => {
    prisma = createPrismaMock();
    analytics = { getEarlyWarningReport: jest.fn(async () => []) };
    svc = new AdminDashboardService(prisma as any, analytics as any);
    prisma.attendance.groupBy.mockResolvedValue([]);
    prisma.grade.groupBy.mockResolvedValue([]);
    prisma.class.findMany.mockResolvedValue([]);
    prisma.payment.aggregate.mockResolvedValue({
      _sum: { amount: null },
      _count: { _all: 0 },
    });
  });

  it('returns an empty but well-formed dashboard for a new school', async () => {
    prisma.academicYear.findFirst.mockResolvedValue(null);
    prisma.school.findUnique.mockResolvedValue(null);

    const result = await svc.getDashboard('s1', NOW);

    // Without an active year everything is scoped through the school.
    expect(prisma.class.findMany.mock.calls[0][0]).toMatchObject({
      where: { academicYear: { schoolId: 's1' } },
    });
    expect(prisma.discipline.count.mock.calls[0][0]).toEqual({
      where: { series: { academicYear: { schoolId: 's1' } } },
    });
    expect(result).toMatchObject({
      generatedAt: NOW.toISOString(),
      school: { name: null },
      academicYear: null,
      attendance: { rate: null, previousRate: null, records: 0 },
      grades: {
        average: null,
        count: 0,
        passRate: null,
        gradedStudents: 0,
        classes: [],
      },
      finance: null,
      risk: { count: 0, students: [] },
      actions: { classesWithoutTeacher: 0, noOpenPeriod: true },
    });
    expect(result.attendance.weekly).toHaveLength(8);
    expect(result.attendance.weekly[0].weekStart).toBe(
      '2026-09-28T00:00:00.000Z',
    );
    expect(result.attendance.weekly[7].weekStart).toBe(
      '2026-11-16T00:00:00.000Z',
    );
  });

  it('computes attendance, grades, finance, risk and action items', async () => {
    prisma.academicYear.findFirst.mockResolvedValue({
      id: 'y1',
      year: '2025-2026',
    });
    prisma.school.findUnique.mockResolvedValue({
      name: 'Lycée',
      enablePayment: true,
    });
    prisma.user.count
      .mockResolvedValueOnce(40) // students
      .mockResolvedValueOnce(5) // teachers
      .mockResolvedValueOnce(3) // pending activation
      .mockResolvedValueOnce(2); // students without class
    prisma.discipline.count.mockResolvedValue(9);
    prisma.academicPeriod.findFirst
      .mockResolvedValueOnce({
        name: 'T1',
        startDate: daysAgo(30),
        endDate: daysAgo(-30),
      })
      .mockResolvedValueOnce(null);
    prisma.class.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'A',
        level: '3eme',
        maxStudents: 30,
        teacherId: 't',
        _count: { students: 25 },
      },
      {
        id: 'c2',
        name: 'B',
        level: '3eme',
        maxStudents: 30,
        teacherId: null,
        _count: { students: 10 },
      },
    ]);
    prisma.attendance.groupBy.mockResolvedValue([
      { date: daysAgo(1), status: 'PRESENT', _count: { _all: 6 } },
      { date: daysAgo(1), status: 'LATE', _count: { _all: 1 } },
      { date: daysAgo(2), status: 'ABSENT', _count: { _all: 1 } },
      { date: daysAgo(40), status: 'ABSENT', _count: { _all: 1 } },
      { date: daysAgo(40), status: 'EXCUSED', _count: { _all: 1 } },
    ]);
    prisma.grade.groupBy
      .mockResolvedValueOnce([
        {
          classId: 'c1',
          maxScore: 20,
          _sum: { score: 30 },
          _count: { _all: 2 },
        },
        {
          classId: 'c1',
          maxScore: 10,
          _sum: { score: 8 },
          _count: { _all: 1 },
        },
        { classId: 'c1', maxScore: 0, _sum: { score: 5 }, _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        {
          studentId: 'a',
          maxScore: 20,
          _sum: { score: 24 },
          _count: { _all: 2 },
        },
        {
          studentId: 'a',
          maxScore: 10,
          _sum: { score: 8 },
          _count: { _all: 1 },
        },
        {
          studentId: 'b',
          maxScore: 20,
          _sum: { score: 6 },
          _count: { _all: 1 },
        },
        {
          studentId: 'c',
          maxScore: 20,
          _sum: { score: null },
          _count: { _all: 0 },
        },
      ]);
    prisma.payment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 15000 } })
      .mockResolvedValueOnce({ _sum: { amount: 9000 } })
      .mockResolvedValueOnce({ _sum: { amount: 4000 }, _count: { _all: 4 } });
    prisma.payment.count.mockResolvedValue(1);
    prisma.academicRequest.count.mockResolvedValue(7);
    prisma.grade.count.mockResolvedValue(12);
    analytics.getEarlyWarningReport.mockResolvedValue([
      {
        studentId: 'x',
        studentName: 'X',
        enrollmentNumber: 'E1',
        atRisk: true,
        currentAbsenceRate: 0.2,
        currentAverage: 8,
        gradeDelta: -4,
        chronicAbsence: false,
        suddenGradeDrop: true,
      },
      {
        studentId: 'y',
        studentName: 'Y',
        enrollmentNumber: 'E2',
        atRisk: true,
        currentAbsenceRate: 0.5,
        currentAverage: 11,
        gradeDelta: 0,
        chronicAbsence: true,
        suddenGradeDrop: false,
      },
      {
        studentId: 'z',
        studentName: 'Z',
        enrollmentNumber: 'E3',
        atRisk: false,
        currentAbsenceRate: 0.9,
      },
    ]);

    const r = await svc.getDashboard('s1', NOW);

    expect(prisma.class.findMany.mock.calls[0][0]).toMatchObject({
      where: { academicYearId: 'y1' },
    });
    expect(prisma.discipline.count.mock.calls[0][0]).toEqual({
      where: { series: { academicYear: { id: 'y1' } } },
    });
    expect(analytics.getEarlyWarningReport).toHaveBeenCalledWith('s1');
    expect(r.academicYear).toBe('2025-2026');
    expect(r.headcount).toEqual({
      students: 40,
      teachers: 5,
      classes: 2,
      disciplines: 9,
      enrolled: 35,
      capacity: 60,
    });
    // Last 30 days: 7 attended of 8; the 30 days before: 1 of 2.
    expect(r.attendance).toMatchObject({
      rate: 0.875,
      previousRate: 0.5,
      records: 8,
    });
    expect(r.attendance.weekly[7]).toEqual({
      weekStart: '2026-11-16T00:00:00.000Z',
      rate: 0.875,
      records: 8,
    });
    // (30 + 16) / 3 grades = 15.33; the maxScore 0 group is ignored.
    expect(r.grades).toMatchObject({
      average: 15.33,
      count: 3,
      gradedStudents: 2,
      passRate: 0.5,
    });
    expect(r.grades.classes).toEqual([
      {
        id: 'c1',
        name: 'A',
        level: '3eme',
        students: 25,
        capacity: 30,
        hasTeacher: true,
        average: 15.33,
      },
      {
        id: 'c2',
        name: 'B',
        level: '3eme',
        students: 10,
        capacity: 30,
        hasTeacher: false,
        average: null,
      },
    ]);
    expect(r.finance).toEqual({
      collectedThisMonth: 15000,
      collectedPreviousMonth: 9000,
      outstandingAmount: 4000,
      outstandingCount: 4,
      overdueCount: 1,
    });
    expect(r.risk.count).toBe(2);
    expect(r.risk.students.map((s) => s.id)).toEqual(['y', 'x']);
    expect(r.risk.students[1]).toEqual({
      id: 'x',
      name: 'X',
      enrollmentNumber: 'E1',
      absenceRate: 0.2,
      average: 8,
      gradeDelta: -4,
      chronicAbsence: false,
      suddenGradeDrop: true,
    });
    expect(r.actions).toEqual({
      pendingRequests: 7,
      pendingActivation: 3,
      draftGrades: 12,
      studentsWithoutClass: 2,
      classesWithoutTeacher: 1,
      noOpenPeriod: false,
    });
  });

  it('defaults to the current time and hides finance when payments are disabled', async () => {
    prisma.academicYear.findFirst.mockResolvedValue(null);
    prisma.school.findUnique.mockResolvedValue({
      name: 'S',
      enablePayment: false,
    });
    const r = await svc.getDashboard('s1');
    expect(r.finance).toBeNull();
    expect(Date.now() - new Date(r.generatedAt).getTime()).toBeLessThan(5000);
  });
});

describe('AdminDashboardController', () => {
  it('serves the admin own school only', async () => {
    const svc = {
      getDashboard: jest.fn(async (_school: string) => ({ ok: true })),
    };
    const ctrl = new AdminDashboardController(svc as any);
    await expect(
      ctrl.getDashboard({ user: { schoolId: 's1' } }),
    ).resolves.toEqual({ ok: true });
    expect(svc.getDashboard).toHaveBeenCalledWith('s1');
    expect(() => ctrl.getDashboard({ user: { schoolId: null } })).toThrow(
      ForbiddenException,
    );
    expect(() => ctrl.getDashboard({})).toThrow(ForbiddenException);
  });
});
