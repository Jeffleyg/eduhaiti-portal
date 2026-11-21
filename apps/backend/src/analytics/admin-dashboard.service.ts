import { Injectable } from '@nestjs/common';
import {
  AcademicRequestStatus,
  AttendanceStatus,
  GradeStatus,
  PaymentStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_WEEKS = 8;
const PASS_MARK = 10; // out of 20
const OPEN_PAYMENT_STATUSES = [
  PaymentStatus.PENDING,
  PaymentStatus.PARTIAL,
  PaymentStatus.OVERDUE,
];
// Late students were in class; only ABSENT counts against attendance.
const ATTENDED = new Set<AttendanceStatus>([
  AttendanceStatus.PRESENT,
  AttendanceStatus.LATE,
  AttendanceStatus.EXCUSED,
]);

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

/** Monday 00:00 UTC of the week that contains `date`. */
export function startOfWeek(date: Date) {
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const offset = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - offset * DAY_MS);
}

type AttendanceGroup = {
  date: Date;
  status: AttendanceStatus;
  _count: { _all: number };
};
type ScoreGroup = {
  maxScore: number;
  _sum: { score: number | null };
  _count: { _all: number };
};

/** Average of grouped scores, each group normalised to /20. */
function averageOn20(groups: ScoreGroup[]) {
  let total = 0;
  let count = 0;
  for (const group of groups) {
    if (group.maxScore <= 0) continue;
    total += ((group._sum.score ?? 0) / group.maxScore) * 20;
    count += group._count._all;
  }
  return count > 0 ? { average: total / count, count } : null;
}

function attendanceRate(rows: AttendanceGroup[]) {
  let total = 0;
  let attended = 0;
  for (const row of rows) {
    total += row._count._all;
    if (ATTENDED.has(row.status)) attended += row._count._all;
  }
  return { total, rate: total > 0 ? round(attended / total, 4) : null };
}

/**
 * Everything the school admin home page needs, in one round trip
 * (the portal is used on slow mobile networks).
 */
@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  async getDashboard(schoolId: string, now = new Date()) {
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
      orderBy: { startDate: 'desc' },
      select: { id: true, year: true },
    });

    const classScope = activeYear
      ? { academicYearId: activeYear.id }
      : { academicYear: { schoolId } };
    const trendStart = new Date(
      startOfWeek(now).getTime() - (TREND_WEEKS - 1) * 7 * DAY_MS,
    );
    const last30 = new Date(now.getTime() - 30 * DAY_MS);
    const previous30 = new Date(now.getTime() - 60 * DAY_MS);
    const attendanceStart = trendStart < previous30 ? trendStart : previous30;
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const previousMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );
    const activeStudents = { role: Role.STUDENT, schoolId, isActive: true };

    const [
      school,
      students,
      teachers,
      classes,
      disciplines,
      currentPeriod,
      nextPeriod,
      attendanceGroups,
      gradesByClass,
      gradesByStudent,
      collectedThisMonth,
      collectedPreviousMonth,
      outstanding,
      overduePayments,
      pendingRequests,
      pendingActivation,
      draftGrades,
      studentsWithoutClass,
      earlyWarning,
    ] = await Promise.all([
      this.prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true, enablePayment: true },
      }),
      this.prisma.user.count({ where: activeStudents }),
      this.prisma.user.count({
        where: { role: Role.TEACHER, schoolId, isActive: true },
      }),
      this.prisma.class.findMany({
        where: classScope,
        select: {
          id: true,
          name: true,
          level: true,
          maxStudents: true,
          teacherId: true,
          _count: { select: { students: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.discipline.count({
        where: {
          series: {
            academicYear: activeYear ? { id: activeYear.id } : { schoolId },
          },
        },
      }),
      this.prisma.academicPeriod.findFirst({
        where: { schoolId, startDate: { lte: now }, endDate: { gte: now } },
        select: { name: true, startDate: true, endDate: true },
      }),
      this.prisma.academicPeriod.findFirst({
        where: { schoolId, startDate: { gt: now } },
        orderBy: { startDate: 'asc' },
        select: { name: true, startDate: true },
      }),
      this.prisma.attendance.groupBy({
        by: ['date', 'status'],
        where: { class: classScope, date: { gte: attendanceStart, lte: now } },
        _count: { _all: true },
      }),
      this.prisma.grade.groupBy({
        by: ['classId', 'maxScore'],
        where: { class: classScope, status: GradeStatus.PUBLISHED },
        _sum: { score: true },
        _count: { _all: true },
      }),
      this.prisma.grade.groupBy({
        by: ['studentId', 'maxScore'],
        where: { class: classScope, status: GradeStatus.PUBLISHED },
        _sum: { score: true },
        _count: { _all: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          schoolId,
          status: PaymentStatus.PAID,
          paidDate: { gte: monthStart, lte: now },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          schoolId,
          status: PaymentStatus.PAID,
          paidDate: { gte: previousMonthStart, lt: monthStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { schoolId, status: { in: OPEN_PAYMENT_STATUSES } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.payment.count({
        where: {
          schoolId,
          status: { in: OPEN_PAYMENT_STATUSES },
          dueDate: { lt: now },
        },
      }),
      this.prisma.academicRequest.count({
        where: {
          status: {
            in: [
              AcademicRequestStatus.PENDING,
              AcademicRequestStatus.IN_REVIEW,
            ],
          },
          student: { schoolId },
        },
      }),
      this.prisma.user.count({
        where: {
          schoolId,
          isActive: true,
          mustChangePassword: true,
          role: { in: [Role.STUDENT, Role.TEACHER] },
        },
      }),
      this.prisma.grade.count({
        where: { class: classScope, status: GradeStatus.DRAFT },
      }),
      this.prisma.user.count({
        where: { ...activeStudents, classesAttending: { none: {} } },
      }),
      this.analytics.getEarlyWarningReport(schoolId),
    ]);

    // Attendance: 30-day rate vs the 30 days before, and an 8-week trend.
    const groups = attendanceGroups as AttendanceGroup[];
    const current = attendanceRate(groups.filter((g) => g.date >= last30));
    const previous = attendanceRate(
      groups.filter((g) => g.date >= previous30 && g.date < last30),
    );
    const weekly = Array.from({ length: TREND_WEEKS }, (_, index) => {
      const weekStart = new Date(trendStart.getTime() + index * 7 * DAY_MS);
      const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
      const { rate, total } = attendanceRate(
        groups.filter((g) => g.date >= weekStart && g.date < weekEnd),
      );
      return { weekStart: weekStart.toISOString(), rate, records: total };
    });

    // Grades: school average, pass rate per student and ranking per class.
    const overall = averageOn20(gradesByClass as ScoreGroup[]);
    const perStudent = new Map<string, ScoreGroup[]>();
    for (const group of gradesByStudent as (ScoreGroup & {
      studentId: string;
    })[]) {
      perStudent.set(group.studentId, [
        ...(perStudent.get(group.studentId) ?? []),
        group,
      ]);
    }
    const studentAverages = [...perStudent.values()]
      .map(averageOn20)
      .filter((value) => value !== null);
    const passing = studentAverages.filter((v) => v.average >= PASS_MARK);

    const classRows = classes.map((item) => {
      const classGrades = (
        gradesByClass as (ScoreGroup & { classId: string })[]
      ).filter((group) => group.classId === item.id);
      const average = averageOn20(classGrades);
      return {
        id: item.id,
        name: item.name,
        level: item.level,
        students: item._count.students,
        capacity: item.maxStudents,
        hasTeacher: Boolean(item.teacherId),
        average: average ? round(average.average) : null,
      };
    });

    const atRisk = earlyWarning
      .filter((student) => student.atRisk)
      .sort((a, b) => b.currentAbsenceRate - a.currentAbsenceRate);

    const enrolled = classRows.reduce((sum, item) => sum + item.students, 0);
    const capacity = classRows.reduce((sum, item) => sum + item.capacity, 0);

    return {
      generatedAt: now.toISOString(),
      school: { name: school?.name ?? null },
      academicYear: activeYear?.year ?? null,
      currentPeriod,
      nextPeriod,
      headcount: {
        students,
        teachers,
        classes: classRows.length,
        disciplines,
        enrolled,
        capacity,
      },
      attendance: {
        rate: current.rate,
        previousRate: previous.rate,
        records: current.total,
        weekly,
      },
      grades: {
        average: overall ? round(overall.average) : null,
        count: overall?.count ?? 0,
        passRate:
          studentAverages.length > 0
            ? round(passing.length / studentAverages.length, 4)
            : null,
        gradedStudents: studentAverages.length,
        classes: classRows,
      },
      finance: school?.enablePayment
        ? {
            collectedThisMonth: collectedThisMonth._sum.amount ?? 0,
            collectedPreviousMonth: collectedPreviousMonth._sum.amount ?? 0,
            outstandingAmount: outstanding._sum.amount ?? 0,
            outstandingCount: outstanding._count._all,
            overdueCount: overduePayments,
          }
        : null,
      risk: {
        count: atRisk.length,
        students: atRisk.slice(0, 5).map((student) => ({
          id: student.studentId,
          name: student.studentName,
          enrollmentNumber: student.enrollmentNumber,
          absenceRate: student.currentAbsenceRate,
          average: student.currentAverage,
          gradeDelta: student.gradeDelta,
          chronicAbsence: student.chronicAbsence,
          suddenGradeDrop: student.suddenGradeDrop,
        })),
      },
      actions: {
        pendingRequests,
        pendingActivation,
        draftGrades,
        studentsWithoutClass,
        classesWithoutTeacher: classRows.filter((item) => !item.hasTeacher)
          .length,
        noOpenPeriod: !currentPeriod,
      },
    };
  }
}
