import { beforeEach, describe, expect, it } from '@jest/globals';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let prisma: PrismaMock;
  let svc: MetricsService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new MetricsService(prisma as any);
    prisma.user.count.mockResolvedValue(0);
    prisma.class.count.mockResolvedValue(0);
    prisma.class.findMany.mockResolvedValue([]);
    prisma.attendance.count.mockResolvedValue(0);
    prisma.grade.findMany.mockResolvedValue([]);
  });

  it('counts students and teachers with optional school', async () => {
    prisma.user.count.mockResolvedValue(7);
    expect((await svc.getTotalActiveStudents('s')).totalStudents).toBe(7);
    expect((await svc.getTotalActiveStudents()).totalStudents).toBe(7);
    expect((await svc.getTotalActiveTeachers('s')).totalTeachers).toBe(7);
    expect((await svc.getTotalActiveTeachers()).totalTeachers).toBe(7);
    const where = prisma.user.count.mock.calls.map((c: any) => c[0].where);
    expect(where[0]).toMatchObject({ school: { id: 's' } });
    expect(where[1]).not.toHaveProperty('school');
  });

  it('returns the default-rate placeholder', async () => {
    expect(await svc.calculateDefaultRate()).toMatchObject({ defaultRate: 0, period: { days: 30 } });
    expect((await svc.calculateDefaultRate('s', 7)).period.days).toBe(7);
  });

  it('computes month-over-month enrollment growth', async () => {
    prisma.user.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(15);
    const r = await svc.getEnrollmentGrowth('s', 3);
    expect(r.data.map((d) => d.growthPercent)).toEqual([0, 50]);
    expect(r.currentMonthEnrollments).toBe(15);
    expect(prisma.user.count.mock.calls[0][0].where).toMatchObject({ school: { id: 's' } });

    const empty = await svc.getEnrollmentGrowth(undefined, 0);
    expect(empty).toEqual({ data: [], currentMonthEnrollments: 0 });
    await svc.getEnrollmentGrowth();
  });

  it('reports enrollment by class', async () => {
    prisma.class.findMany.mockResolvedValue([
      { id: 'a', name: 'A', maxStudents: 20, _count: { students: 10 } },
      { id: 'b', name: 'B', maxStudents: null, _count: { students: 3 } },
    ]);
    expect(await svc.getEnrollmentByClass('s')).toEqual([
      { classId: 'a', className: 'A', studentCount: 10, capacity: 20, occupancyRate: 50 },
      { classId: 'b', className: 'B', studentCount: 3, capacity: null, occupancyRate: 0 },
    ]);
    await svc.getEnrollmentByClass();
    expect(prisma.class.findMany.mock.calls[1][0].where).toBeUndefined();
  });

  it('computes attendance percentages', async () => {
    prisma.attendance.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    expect(await svc.getAttendanceStatistics('s', 7)).toMatchObject({
      totalRecords: 10,
      presentPercent: 70,
      absentPercent: 20,
      latePercent: 10,
    });
    expect(await svc.getAttendanceStatistics()).toMatchObject({ presentPercent: 0, absentPercent: 0, latePercent: 0 });
  });

  it('buckets grades on the /20 scale, normalising other maxScores', async () => {
    expect(await svc.getGradeDistribution()).toEqual({
      distribution: {},
      statistics: { average: 0, highest: 0, lowest: 0, count: 0, scale: 20 },
    });
    prisma.grade.findMany.mockResolvedValue([
      { score: 3, maxScore: 20 },
      { score: 8, maxScore: 20 },
      { score: 11, maxScore: 20 },
      { score: 70, maxScore: 100 }, // 14/20
      { score: 9, maxScore: 10 }, // 18/20
      { score: 25, maxScore: 0 }, // invalid max: treated as /20 and capped at 20
    ]);
    const r = await svc.getGradeDistribution('s');
    expect(prisma.grade.findMany.mock.calls[1][0].select).toEqual({ score: true, maxScore: true });
    expect(r.distribution).toEqual({ '0-5': 1, '5-10': 1, '10-12': 1, '12-16': 1, '16-20': 2 });
    expect(r.statistics).toEqual({ average: 12.33, highest: 20, lowest: 3, count: 6, scale: 20 });
  });

  it('builds the executive dashboard', async () => {
    prisma.class.count.mockResolvedValue(4);
    const r = await svc.generateExecutiveDashboard();
    expect(r.summary.totalClasses).toBe(4);
    expect(r.enrollment.monthGrowthPercent).toBe(0);
    await svc.generateExecutiveDashboard('s');
    expect(prisma.class.count.mock.calls[1][0]).toEqual({ where: { academicYear: { schoolId: 's' } } });
  });

  describe('getSchoolPerformanceMetrics', () => {
    const dashboard = (over: { present?: number; absent?: number; avg?: number; growth?: number }) => ({
      summary: {},
      enrollment: { current: 0, monthGrowthPercent: over.growth ?? 0, trend: [] },
      attendance: { presentPercent: over.present ?? 100, absentPercent: over.absent ?? 0, latePercent: 0, period: '' },
      academics: { averageGrade: over.avg ?? 20, gradeDistribution: {}, highestGrade: 0, lowestGrade: 0 },
    });
    const run = async (dash: any, occupancy: number[]) => {
      (svc as any).generateExecutiveDashboard = async () => dash;
      (svc as any).getEnrollmentByClass = async () => occupancy.map((occupancyRate) => ({ occupancyRate }));
      return svc.getSchoolPerformanceMetrics('s');
    };

    it('gives a perfect school 100 points and no warnings', async () => {
      const r = await run(dashboard({}), [80]);
      expect(r.performanceScore).toBe(100);
      expect(r.recommendations).toEqual(['School is performing well. Maintain current strategies.']);
    });

    it('flags weak schools as low performance', async () => {
      const r = await run(dashboard({ present: 20, avg: 4, growth: -20 }), [10]);
      // 6 (attendance) + 6 (grades) + 5 (enrollment) + 10 (occupancy)
      expect(r.performanceScore).toBe(27);
      expect(r.recommendations).toContain('Overall performance is low. Schedule a review meeting with school administration.');
    });

    it('covers growth and occupancy bands and recommendations', async () => {
      const high = await run(dashboard({ growth: 20, absent: 30, avg: 9 }), [95]);
      expect(high.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('High absence'),
          expect.stringContaining('below passing'),
        ]),
      );
      const low = await run(dashboard({ growth: -20 }), []);
      expect(low.recommendations).toEqual(expect.arrayContaining([expect.stringContaining('Declining enrollment')]));
    });

    it('says the school performs well when nothing is wrong', () => {
      const recs = (svc as any).generateRecommendations(80, dashboard({}));
      expect(recs).toEqual(['School is performing well. Maintain current strategies.']);
    });
  });

  it('reports resource utilization', async () => {
    prisma.class.count.mockResolvedValue(3);
    prisma.resource.count.mockResolvedValue(9);
    prisma.user.count.mockResolvedValue(2);
    expect(await svc.getResourceUtilization('s')).toEqual({
      schoolId: 's',
      resources: { classrooms: 3, teachingMaterials: 9, teachers: 2, laboratories: 3 },
      utilizationScore: 0,
    });
  });
});
