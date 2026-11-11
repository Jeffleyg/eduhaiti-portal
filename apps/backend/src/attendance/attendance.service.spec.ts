import { BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AttendanceStatus, Role } from '@prisma/client';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { autoMock, AutoMock } from '../test-utils/auto-mock';
import { AttendanceService } from './attendance.service';

const flush = () => new Promise((r) => setImmediate(r));

describe('AttendanceService', () => {
  let prisma: PrismaMock;
  let sms: AutoMock;
  let svc: AttendanceService;

  beforeEach(() => {
    prisma = createPrismaMock();
    sms = autoMock();
    svc = new AttendanceService(prisma as any, sms as any);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('markAttendance', () => {
    const payload = (over: Record<string, unknown> = {}) =>
      ({ studentId: 's', classId: 'c', date: new Date('2026-03-02T10:00:00'), status: AttendanceStatus.PRESENT, ...over }) as any;
    const cls = { id: 'c', name: '3e', teacherId: 't', students: [{ id: 's' }] };
    const record = (over: Record<string, unknown> = {}) => ({
      id: 'att',
      student: { id: 's', name: 'Ana' },
      class: { name: '3e' },
      ...over,
    });

    it('validates student, class, teacher and enrollment', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(svc.markAttendance(payload())).rejects.toThrow('Student not found');
      prisma.user.findUnique.mockResolvedValue({ id: 's' });
      prisma.class.findUnique.mockResolvedValueOnce(null);
      await expect(svc.markAttendance(payload())).rejects.toBeInstanceOf(NotFoundException);
      prisma.class.findUnique.mockResolvedValue(cls);
      await expect(svc.markAttendance(payload(), { id: 'x', role: Role.TEACHER })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(svc.markAttendance(payload({ studentId: 'z' }))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a record, writes a family notice and skips SMS when present', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 's' });
      prisma.class.findUnique.mockResolvedValue(cls);
      prisma.attendance.findFirst.mockResolvedValue(null);
      prisma.attendance.create.mockResolvedValue(record());
      await svc.markAttendance(payload({ remarks: ' late bus ' }), { id: 't', role: Role.TEACHER });
      const notice = prisma.auditLog.create.mock.calls[0][0].data;
      expect(notice).toMatchObject({ entityType: 'FAMILY_NOTICE', entityId: 's', userId: 't' });
      expect(notice.changes).toMatchObject({ severity: 'normal', attendanceStatus: 'PRESENT' });
      expect(notice.changes.body).toContain('Observation : late bus.');
      await flush();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('updates an existing record and alerts guardians on new absences', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 's' });
      prisma.class.findUnique.mockResolvedValue(cls);
      prisma.attendance.findFirst.mockResolvedValue({ id: 'att', status: 'PRESENT' });
      prisma.attendance.update.mockResolvedValue(record({ student: { id: 's', name: null } }));
      prisma.$queryRaw.mockResolvedValue([
        { phoneNumber: ' 509 ' },
        { phoneNumber: '509' },
        { phoneNumber: null },
        { phoneNumber: '510' },
      ]);
      await svc.markAttendance(payload({ status: AttendanceStatus.ABSENT, remarks: 'sick' }));
      await flush();
      expect(prisma.attendance.update).toHaveBeenCalled();
      expect(prisma.auditLog.create.mock.calls[0][0].data.changes.severity).toBe('urgent');
      expect(sms.sendSms.mock.calls.map((c: any) => c[0].to)).toEqual(['509', '510']);
      expect(sms.sendSms.mock.calls[0][0].text).toContain('Aluno sem nome cadastrado');
      expect(sms.sendSms.mock.calls[0][0].text).toContain('Nòt: sick.');
    });

    it('does not re-alert when the student was already absent', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 's' });
      prisma.class.findUnique.mockResolvedValue(cls);
      prisma.attendance.findFirst.mockResolvedValue({ id: 'att', status: 'ABSENT' });
      prisma.attendance.update.mockResolvedValue(record());
      await svc.markAttendance(payload({ status: AttendanceStatus.ABSENT }));
      await flush();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('skips SMS without guardian phones and logs failures', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 's' });
      prisma.class.findUnique.mockResolvedValue(cls);
      prisma.attendance.findFirst.mockResolvedValue(null);
      prisma.attendance.create.mockResolvedValue(record());
      prisma.$queryRaw.mockResolvedValueOnce([]);
      await svc.markAttendance(payload({ status: AttendanceStatus.ABSENT }));
      await flush();
      expect(sms.sendSms).not.toHaveBeenCalled();

      prisma.$queryRaw.mockRejectedValueOnce(new Error('no table'));
      await svc.markAttendance(payload({ status: AttendanceStatus.ABSENT }));
      await flush();
      prisma.$queryRaw.mockRejectedValueOnce('weird');
      await svc.markAttendance(payload({ status: AttendanceStatus.ABSENT }));
      await flush();
      const warnings = (Logger.prototype.warn as jest.Mock).mock.calls.map((c) => c[0]);
      expect(warnings).toEqual([
        expect.stringContaining('no table'),
        expect.stringContaining('absence_sms_unknown_error'),
      ]);
    });

    it('labels every status in the family notice', async () => {
      const build = (status: AttendanceStatus) =>
        (svc as any).buildAttendanceFamilyNotice({ status, date: new Date(), className: 'C', attendanceId: 'a' });
      expect(build(AttendanceStatus.LATE).body).toContain('en retard');
      expect(build(AttendanceStatus.EXCUSED).body).toContain('absence justifiée');
    });
  });

  it('truncates SMS text to 160 characters', () => {
    const cut = (t: string) => (svc as any).to160Chars(t);
    expect(cut('short')).toBe('short');
    expect(cut('word '.repeat(60)).length).toBeLessThanOrEqual(160);
    expect(cut('x'.repeat(300))).toBe('x'.repeat(157) + '...');
  });

  it('queries attendance with optional date filters', async () => {
    const d1 = new Date('2026-01-01');
    const d2 = new Date('2026-02-01');
    await svc.findByStudent('s', d1, d2);
    await svc.findByStudent('s', d1);
    await svc.findByStudent('s', undefined, d2);
    await svc.findByStudent('s');
    await svc.findByClass('c', new Date('2026-01-05T12:00:00'));
    await svc.findByClass('c');
    const where = prisma.attendance.findMany.mock.calls.map((c: any) => c[0].where);
    expect(where[0]).toEqual({ studentId: 's', date: { gte: d1, lte: d2 } });
    expect(where[1]).toEqual({ studentId: 's', date: { gte: d1 } });
    expect(where[2]).toEqual({ studentId: 's', date: { lte: d2 } });
    expect(where[3]).toEqual({ studentId: 's' });
    expect(where[4].date.gte).toBeInstanceOf(Date);
    expect(where[5]).toEqual({ classId: 'c' });
  });

  it('computes stats and the class report', async () => {
    prisma.attendance.findMany.mockResolvedValueOnce([]);
    expect(await svc.getStudentAttendanceStats('s', 'c')).toMatchObject({ total: 0, absencePercentage: 0, isAtRisk: false });

    prisma.attendance.findMany.mockResolvedValue([
      { status: 'PRESENT' },
      { status: 'ABSENT' },
      { status: 'LATE' },
      { status: 'EXCUSED' },
      { status: 'OTHER' },
    ]);
    expect(await svc.getStudentAttendanceStats('s', 'c')).toEqual({
      total: 5,
      present: 1,
      absent: 1,
      late: 1,
      excused: 1,
      absencePercentage: 20,
      isAtRisk: false,
    });

    prisma.user.findMany.mockResolvedValue([{ id: 's', name: 'A', email: 'e' }]);
    const report = await svc.getClassAttendanceReport('c');
    expect(report[0]).toMatchObject({ student: { id: 's' }, total: 5 });
  });

  it('deletes or throws when missing', async () => {
    prisma.attendance.findUnique.mockResolvedValueOnce(null);
    await expect(svc.delete('a')).rejects.toBeInstanceOf(NotFoundException);
    prisma.attendance.findUnique.mockResolvedValueOnce({ id: 'a' });
    await expect(svc.delete('a')).resolves.toEqual({ message: 'Attendance record deleted' });
  });
});
