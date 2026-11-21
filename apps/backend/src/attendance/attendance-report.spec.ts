import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Role } from '@prisma/client';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { AttendanceReportService } from './attendance-report.service';
import { AttendanceReportController } from './attendance-report.controller';
import { attendanceFileName, buildAttendanceCsv } from './attendance-export';
import { csvDocument, csvFormat, isoDay } from '../common/csv';

const day = (iso: string) => new Date(`${iso}T08:00:00Z`);
const group = (
  studentId: string,
  classId: string,
  status: string,
  n: number,
) => ({
  studentId,
  classId,
  status,
  _count: { _all: n },
});

describe('common csv helpers', () => {
  it('formats per language and builds a document', () => {
    expect(csvFormat('en')).toEqual({ separator: ',', decimal: '.' });
    expect(csvFormat('ht')).toEqual({ separator: ';', decimal: ',' });
    expect(isoDay(null)).toBe('');
    expect(isoDay(new Date('2026-11-21T10:00:00Z'))).toBe('2026-11-21');
    expect(
      csvDocument(
        ['a', 'b'],
        [
          [1, null],
          ['=x', 'y;z'],
        ],
        ';',
      ),
    ).toBe(String.fromCharCode(0xfeff) + 'a;b\r\n1;\r\n\'=x;"y;z"\r\n');
  });
});

describe('attendance export', () => {
  it('writes one line per student with a localized rate', () => {
    const rows = [
      {
        name: 'Ana',
        enrollmentNumber: 'E1',
        className: '3e',
        records: 4,
        present: 2,
        late: 1,
        excused: 0,
        absent: 1,
        rate: 0.75,
      },
      {
        name: null,
        enrollmentNumber: null,
        className: null,
        records: 0,
        present: 0,
        late: 0,
        excused: 0,
        absent: 0,
        rate: null,
      },
    ];
    const [header, first, second] = buildAttendanceCsv(rows, 'fr')
      .slice(1)
      .split('\r\n');
    expect(header).toBe(
      'Élève;Matricule;Classe;Relevés;Présent;Retard;Excusé;Absent;Taux de présence (%)',
    );
    expect(first).toBe('Ana;E1;3e;4;2;1;0;1;75,0');
    expect(second).toBe(';;;0;0;0;0;0;');
    expect(buildAttendanceCsv(rows, 'en').split('\r\n')[1]).toBe(
      'Ana,E1,3e,4,2,1,0,1,75.0',
    );
    expect(attendanceFileName('ht', new Date('2026-11-21T00:00:00Z'))).toBe(
      'prezans-2026-11-21.csv',
    );
    expect(attendanceFileName('pt').startsWith('presencas-')).toBe(true);
  });
});

describe('AttendanceReportService', () => {
  let prisma: PrismaMock;
  let svc: AttendanceReportService;

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new AttendanceReportService(prisma as any);
    prisma.class.findMany.mockResolvedValue([]);
    prisma.attendance.groupBy.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
  });

  it('validates the period', async () => {
    const scope = { schoolId: 's', classWhere: {} };
    await expect(svc.build(scope, { startDate: 'x' })).rejects.toThrow(
      'Invalid startDate',
    );
    await expect(svc.build(scope, { endDate: 'x' })).rejects.toThrow(
      'Invalid endDate',
    );
    await expect(
      svc.build(scope, { startDate: '2026-11-10', endDate: '2026-11-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns an empty report without records or school', async () => {
    const r = await svc.build(
      { schoolId: null, classWhere: { teacherId: 't' } },
      {},
    );
    expect(prisma.school.findUnique).not.toHaveBeenCalled();
    expect(prisma.attendance.groupBy.mock.calls[0][0].where).toEqual({
      class: { teacherId: 't' },
    });
    expect(r).toMatchObject({
      school: null,
      period: { startDate: null, endDate: null },
      totals: { records: 0, rate: null, students: 0, classesWithoutRecords: 0 },
      daily: [],
      classes: [],
      students: [],
    });
  });

  it('aggregates totals, classes, students and days', async () => {
    prisma.school.findUnique.mockResolvedValue({ name: 'Lycée' });
    prisma.class.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: '3e A',
        level: '3e',
        teacher: { name: 'Clair' },
        academicYear: { isActive: true },
        _count: { students: 3 },
      },
      {
        id: 'c2',
        name: '3e B',
        level: '3e',
        teacher: null,
        academicYear: { isActive: true },
        _count: { students: 2 },
      },
      {
        id: 'old',
        name: 'Ancienne',
        level: '4e',
        teacher: null,
        academicYear: { isActive: false },
        _count: { students: 0 },
      },
      {
        id: 'past',
        name: 'Passée',
        level: '4e',
        teacher: null,
        academicYear: null,
        _count: { students: 1 },
      },
    ]);
    prisma.attendance.groupBy
      .mockResolvedValueOnce([
        group('ana', 'c1', 'PRESENT', 3),
        group('ana', 'c1', 'ABSENT', 1),
        group('bob', 'c1', 'LATE', 2),
        group('bob', 'c1', 'EXCUSED', 2),
        group('gone', 'past', 'ABSENT', 2),
        group('zed', 'c1', 'PRESENT', 4),
      ])
      .mockResolvedValueOnce([
        { date: day('2026-11-03'), status: 'PRESENT', _count: { _all: 5 } },
        { date: day('2026-11-03'), status: 'ABSENT', _count: { _all: 3 } },
        { date: day('2026-11-02'), status: 'LATE', _count: { _all: 2 } },
        { date: day('2026-11-03'), status: 'EXCUSED', _count: { _all: 2 } },
        { date: day('2026-11-02'), status: 'PRESENT', _count: { _all: 2 } },
      ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'ana', name: 'Ana', enrollmentNumber: 'E1' },
      { id: 'bob', name: 'Bob', enrollmentNumber: null },
      { id: 'zed', name: 'Zed', enrollmentNumber: 'E3' },
    ]);

    const r = await svc.build(
      { schoolId: 's', classWhere: { academicYear: { schoolId: 's' } } },
      { startDate: '2026-11-01', endDate: '2026-11-30T23:59:59.999Z' },
    );

    expect(prisma.school.findUnique).toHaveBeenCalledWith({
      where: { id: 's' },
      select: { name: true, address: true, city: true },
    });
    expect(prisma.attendance.groupBy.mock.calls[0][0].where).toEqual({
      class: { academicYear: { schoolId: 's' } },
      date: {
        gte: new Date('2026-11-01'),
        lte: new Date('2026-11-30T23:59:59.999Z'),
      },
    });
    expect(r.school).toEqual({ name: 'Lycée' });
    expect(r.period).toEqual({
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.999Z',
    });
    // 14 records, 3 absent.
    expect(r.totals).toEqual({
      records: 14,
      present: 7,
      late: 2,
      excused: 2,
      absent: 3,
      rate: 0.7857,
      students: 4,
      classesWithoutRecords: 1,
    });
    // Inactive-year classes appear only when they have records.
    expect(
      r.classes.map((c) => [c.id, c.records, c.rate, c.teacherName]),
    ).toEqual([
      ['c1', 12, 0.9167, 'Clair'],
      ['c2', 0, null, null],
      ['past', 2, 0, null],
    ]);
    // Lowest attendance first, then by name; unknown students keep null names.
    expect(r.students.map((s) => [s.studentId, s.rate, s.className])).toEqual([
      ['gone', 0, 'Passée'],
      ['ana', 0.75, '3e A'],
      ['bob', 1, '3e A'],
      ['zed', 1, '3e A'],
    ]);
    expect(r.students[0]).toMatchObject({ name: null, enrollmentNumber: null });
    expect(r.daily).toEqual([
      { date: '2026-11-02', records: 4, rate: 1 },
      { date: '2026-11-03', records: 10, rate: 0.7 },
    ]);
  });

  it('only filters by the dates given', async () => {
    await svc.build(
      { schoolId: null, classWhere: {} },
      { startDate: '2026-11-01' },
    );
    await svc.build(
      { schoolId: null, classWhere: {} },
      { endDate: '2026-11-30' },
    );
    const calls = prisma.attendance.groupBy.mock.calls.map(
      (c: any) => c[0].where.date,
    );
    expect(calls[0]).toEqual({ gte: new Date('2026-11-01') });
    expect(calls[2]).toEqual({ lte: new Date('2026-11-30') });
  });

  it('sorts students without a rate last and names alphabetically', async () => {
    prisma.attendance.groupBy.mockResolvedValueOnce([
      group('b', 'c', 'PRESENT', 1),
      group('a', 'c', 'PRESENT', 1),
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'a', name: null, enrollmentNumber: null },
      { id: 'b', name: 'Béa', enrollmentNumber: null },
    ]);
    const r = await svc.build({ schoolId: null, classWhere: {} }, {});
    expect(r.students.map((s) => s.studentId)).toEqual(['a', 'b']);
    expect(r.students[0].className).toBeNull();
  });
});

describe('AttendanceReportController', () => {
  const make = () => {
    const reports = {
      build: jest.fn(async (..._a: any[]) => ({
        students: [
          {
            name: 'Ana',
            enrollmentNumber: 'E1',
            className: 'A',
            records: 1,
            present: 1,
            late: 0,
            excused: 0,
            absent: 0,
            rate: 1,
          },
        ],
      })),
    };
    const access = {
      assertCanManageClass: jest.fn(async (..._a: any[]) => ({
        academicYear: { schoolId: 'from-class' },
      })),
    };
    return {
      reports,
      access,
      ctrl: new AttendanceReportController(reports as any, access as any),
    };
  };
  const admin = { user: { sub: 'a', role: Role.ADMIN, schoolId: 's' } };
  const teacher = { user: { sub: 't', role: Role.TEACHER, schoolId: 's' } };

  it('scopes to one class, the school or the teacher classes', async () => {
    const { reports, access, ctrl } = make();
    await ctrl.report(teacher, { classId: 'c1', startDate: '2026-11-01' });
    await ctrl.report(admin, {});
    await ctrl.report(teacher, {});
    await ctrl.report({ user: { role: Role.TEACHER } }, {});
    expect(access.assertCanManageClass).toHaveBeenCalledWith(
      'c1',
      teacher.user,
    );
    expect(reports.build.mock.calls.map((c: any) => c[0])).toEqual([
      { schoolId: 'from-class', classWhere: { id: 'c1' } },
      { schoolId: 's', classWhere: { academicYear: { schoolId: 's' } } },
      { schoolId: 's', classWhere: { teacherId: 't' } },
      { schoolId: null, classWhere: { teacherId: '' } },
    ]);

    access.assertCanManageClass.mockResolvedValueOnce({
      academicYear: null,
    } as any);
    await ctrl.report(admin, { classId: 'c2' });
    expect(reports.build.mock.calls[4][0]).toEqual({
      schoolId: null,
      classWhere: { id: 'c2' },
    });
  });

  it('refuses an admin without school and propagates class access errors', async () => {
    const { access, ctrl } = make();
    await expect(
      ctrl.report({ user: { sub: 'a', role: Role.ADMIN } }, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    access.assertCanManageClass.mockRejectedValueOnce(
      new ForbiddenException('Teacher can only manage own classes'),
    );
    await expect(
      ctrl.report(teacher, { classId: 'other' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exports the students as a localized CSV file', async () => {
    const { ctrl } = make();
    const res = { setHeader: jest.fn() };
    const csv = await ctrl.export(admin, { lang: 'en' }, res as any);
    expect(csv.split('\r\n')[1]).toBe('Ana,E1,A,1,1,0,0,0,100.0');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(res.setHeader.mock.calls[1][1]).toMatch(
      /^attachment; filename="attendance-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    await ctrl.export(admin, {}, res as any);
    expect(res.setHeader.mock.calls[3][1]).toMatch(/filename="presences-/);
  });
});
