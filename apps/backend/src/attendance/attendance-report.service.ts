import { BadRequestException, Injectable } from '@nestjs/common';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AttendanceCounts = {
  records: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  /** Share of sessions attended (present, late or excused); null without records. */
  rate: number | null;
};

const KEY: Record<AttendanceStatus, 'present' | 'late' | 'excused' | 'absent'> =
  {
    PRESENT: 'present',
    LATE: 'late',
    EXCUSED: 'excused',
    ABSENT: 'absent',
  };

const emptyCounts = (): AttendanceCounts => ({
  records: 0,
  present: 0,
  late: 0,
  excused: 0,
  absent: 0,
  rate: null,
});

function add(
  target: AttendanceCounts,
  status: AttendanceStatus,
  count: number,
) {
  target.records += count;
  target[KEY[status]] += count;
}

function finish(counts: AttendanceCounts): AttendanceCounts {
  counts.rate =
    counts.records > 0
      ? Number(((counts.records - counts.absent) / counts.records).toFixed(4))
      : null;
  return counts;
}

function parseDate(value: string | undefined, name: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${name}`);
  }
  return date;
}

export type AttendanceReportScope = {
  schoolId: string | null;
  /** Restricts the report to these classes (a teacher's or a single class). */
  classWhere: Prisma.ClassWhereInput;
};

/**
 * Attendance over a period for a school, a teacher's classes or one class:
 * totals, daily trend, one row per class and one row per student/class.
 * Everything is computed from grouped counts (no per-student queries).
 */
@Injectable()
export class AttendanceReportService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    scope: AttendanceReportScope,
    filters: { startDate?: string; endDate?: string },
  ) {
    const start = parseDate(filters.startDate, 'startDate');
    const end = parseDate(filters.endDate, 'endDate');
    if (start && end && end < start) {
      throw new BadRequestException('endDate must be after startDate');
    }
    const date =
      start || end
        ? { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) }
        : undefined;
    const recordWhere: Prisma.AttendanceWhereInput = {
      class: scope.classWhere,
      ...(date ? { date } : {}),
    };

    const [school, classes, byStudent, byDay] = await Promise.all([
      scope.schoolId
        ? this.prisma.school.findUnique({
            where: { id: scope.schoolId },
            select: { name: true, address: true, city: true },
          })
        : null,
      this.prisma.class.findMany({
        where: scope.classWhere,
        select: {
          id: true,
          name: true,
          level: true,
          teacher: { select: { name: true } },
          academicYear: { select: { isActive: true } },
          _count: { select: { students: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.attendance.groupBy({
        by: ['studentId', 'classId', 'status'],
        where: recordWhere,
        _count: { _all: true },
      }),
      this.prisma.attendance.groupBy({
        by: ['date', 'status'],
        where: recordWhere,
        _count: { _all: true },
      }),
    ]);

    const students = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(byStudent.map((g) => g.studentId))] } },
      select: { id: true, name: true, enrollmentNumber: true },
    });
    const studentById = new Map(students.map((s) => [s.id, s]));

    const totals = emptyCounts();
    const perClass = new Map<string, AttendanceCounts>();
    const perStudent = new Map<
      string,
      AttendanceCounts & { studentId: string; classId: string }
    >();
    for (const group of byStudent) {
      const count = group._count._all;
      add(totals, group.status, count);
      const classCounts = perClass.get(group.classId) ?? emptyCounts();
      add(classCounts, group.status, count);
      perClass.set(group.classId, classCounts);
      const key = `${group.studentId}:${group.classId}`;
      const studentCounts = perStudent.get(key) ?? {
        ...emptyCounts(),
        studentId: group.studentId,
        classId: group.classId,
      };
      add(studentCounts, group.status, count);
      perStudent.set(key, studentCounts);
    }

    const classById = new Map(classes.map((c) => [c.id, c]));
    // Current-year classes always appear, so a class where nobody takes the
    // roll shows up as "no records" instead of silently disappearing.
    const classRows = classes
      .filter((c) => c.academicYear?.isActive || perClass.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        level: c.level,
        teacherName: c.teacher?.name ?? null,
        students: c._count.students,
        ...finish(perClass.get(c.id) ?? emptyCounts()),
      }));

    const studentRows = [...perStudent.values()]
      .map((row) => {
        const counts = finish({ ...row });
        const student = studentById.get(row.studentId);
        return {
          studentId: row.studentId,
          name: student?.name ?? null,
          enrollmentNumber: student?.enrollmentNumber ?? null,
          classId: row.classId,
          className: classById.get(row.classId)?.name ?? null,
          records: counts.records,
          present: counts.present,
          late: counts.late,
          excused: counts.excused,
          absent: counts.absent,
          rate: counts.rate,
        };
      })
      .sort(
        (a, b) =>
          (a.rate ?? 1) - (b.rate ?? 1) ||
          (a.name ?? '').localeCompare(b.name ?? ''),
      );

    const days = new Map<string, AttendanceCounts>();
    for (const group of byDay) {
      const day = group.date.toISOString().slice(0, 10);
      const counts = days.get(day) ?? emptyCounts();
      add(counts, group.status, group._count._all);
      days.set(day, counts);
    }
    const daily = [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, counts]) => ({
        date: day,
        records: counts.records,
        rate: finish(counts).rate,
      }));

    return {
      generatedAt: new Date().toISOString(),
      school,
      period: {
        startDate: start?.toISOString() ?? null,
        endDate: end?.toISOString() ?? null,
      },
      totals: {
        ...finish(totals),
        students: new Set(studentRows.map((row) => row.studentId)).size,
        classesWithoutRecords: classRows.filter((row) => row.records === 0)
          .length,
      },
      daily,
      classes: classRows,
      students: studentRows,
    };
  }
}
