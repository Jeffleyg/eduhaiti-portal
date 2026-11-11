import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Role } from '@prisma/client';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { autoMock, AutoMock } from '../test-utils/auto-mock';

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { hash: jest.fn(async () => 'hashed') },
}));

import { UsersService } from './users.service';
import { GuardiansService } from './guardians.service';

describe('UsersService', () => {
  let prisma: PrismaMock;
  let email: AutoMock;
  let svc: UsersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    email = autoMock();
    svc = new UsersService(prisma as any, email as any, new GuardiansService(prisma as any));
    prisma.user.findFirst.mockResolvedValue({ enrollmentNumber: `${new Date().getFullYear()}-0004` });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async (a: any) => ({ id: 'u', ...a.data }));
  });

  it('finds by id', async () => {
    await svc.findById('u');
    expect(prisma.user.findUnique.mock.calls[0][0].where).toEqual({ id: 'u' });
  });

  describe('createStudent', () => {
    const base = { email: ' A@B.C ', firstName: 'Ana', lastName: 'Lima' } as any;

    it('rejects duplicates', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'x' });
      await expect(svc.createStudent(base)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('applies defaults for date, names and filiation', async () => {
      const r = await svc.createStudent({ email: 'x@y.z' } as any);
      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        name: 'Élève',
        fatherName: null,
        motherName: null,
        address: null,
        gender: null,
        role: Role.STUDENT,
        dateOfBirth: new Date('2010-01-01'),
        enrollmentNumber: `${new Date().getFullYear()}-0005`,
        passwordHash: 'hashed',
      });
      // Email delivered: the password is not sent back to the client.
      expect(r).toMatchObject({ emailSent: expect.anything() });
      expect(r).not.toHaveProperty('tempPassword');
      const sentPassword = email.sendTempPasswordEmail.mock.calls[0][1];
      expect(sentPassword).toMatch(/^[a-zA-Z0-9]{10}$/);
      expect(email.sendTempPasswordEmail).toHaveBeenCalledWith('x@y.z', sentPassword, expect.any(Date));
    });

    it('creates the student and the guardian phones in one transaction', async () => {
      prisma.guardian.findFirst.mockResolvedValue(null);
      prisma.guardian.create.mockImplementation(async (a: any) => ({ id: `g-${a.data.relationship}`, ...a.data }));
      prisma.guardianStudent.findMany.mockResolvedValue([]);
      await svc.createStudent({
        ...base,
        fatherName: 'Jean',
        fatherPhone: '+509 3712-3456',
        motherPhone: '3800 0000',
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.guardian.create.mock.calls.map((c: any) => c[0].data)).toEqual([
        { fullName: 'Jean', phoneNumber: '+50937123456', documentId: null, relationship: 'FATHER' },
        { fullName: 'Mãe Lima', phoneNumber: '38000000', documentId: null, relationship: 'MOTHER' },
      ]);
      expect(prisma.guardianStudent.upsert).toHaveBeenCalledTimes(2);
    });

    it('skips guardians when no phone is given', async () => {
      await svc.createStudent(base);
      expect(prisma.guardian.create).not.toHaveBeenCalled();
    });

    it('numbers enrollments after the highest one, starting at 0001', async () => {
      const year = new Date().getFullYear();
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await svc.createStudent({ email: 'a@y.z' } as any);
      prisma.user.findFirst.mockResolvedValueOnce({ enrollmentNumber: `${year}-oops` });
      await svc.createStudent({ email: 'b@y.z' } as any);
      prisma.user.findFirst.mockResolvedValueOnce({ enrollmentNumber: `${year}-0041` });
      await svc.createStudent({ email: 'c@y.z' } as any);
      expect(prisma.user.create.mock.calls.map((c: any) => c[0].data.enrollmentNumber)).toEqual([
        `${year}-0001`,
        `${year}-0001`,
        `${year}-0042`,
      ]);
      expect(prisma.user.findFirst.mock.calls[0][0]).toMatchObject({
        where: { enrollmentNumber: { startsWith: `${year}-` } },
        orderBy: { enrollmentNumber: 'desc' },
      });
    });

    it('falls back to the default date for invalid input and keeps valid dates', async () => {
      await svc.createStudent({ ...base, dateOfBirth: 'nope' });
      await svc.createStudent({ ...base, dateOfBirth: '2012-05-05', fatherName: ' P ', motherName: ' M ' });
      const [a, b] = prisma.user.create.mock.calls.map((c: any) => c[0].data);
      expect(a.dateOfBirth).toEqual(new Date('2010-01-01'));
      expect(b).toMatchObject({ dateOfBirth: new Date('2012-05-05'), fatherName: 'P', motherName: 'M', name: 'Ana Lima' });
    });

    it('validates and connects the class, resolving the school', async () => {
      prisma.class.findUnique.mockResolvedValueOnce(null);
      await expect(svc.createStudent({ ...base, classId: 'c' })).rejects.toThrow('Turma');

      prisma.class.findUnique.mockResolvedValue({ id: 'c', academicYear: { schoolId: 's1' } });
      await expect(svc.createStudent({ ...base, classId: 'c' }, 's2')).rejects.toThrow('another school');

      await svc.createStudent({ ...base, classId: 'c' });
      await svc.createStudent({ ...base, classId: 'c' }, 's1');
      const data = prisma.user.create.mock.calls.map((c: any) => c[0].data);
      expect(data[0]).toMatchObject({ schoolId: 's1', classesAttending: { connect: [{ id: 'c' }] } });
      expect(data[1].schoolId).toBe('s1');
    });

    it('returns the password once when the email cannot be sent', async () => {
      email.sendTempPasswordEmail.mockResolvedValueOnce(false);
      const unsent = await svc.createStudent(base);
      expect(unsent).toMatchObject({ emailSent: false, tempPassword: expect.stringMatching(/^[a-zA-Z0-9]{10}$/) });

      email.sendTempPasswordEmail.mockRejectedValueOnce(new Error('smtp'));
      const failed = await svc.createStudent(base);
      expect(failed).toMatchObject({ emailSent: false, tempPassword: expect.any(String) });
    });
  });

  describe('createTeacher', () => {
    const teacher = (over: Record<string, unknown> = {}) =>
      ({
        email: ' T@X.Y ',
        firstName: 'Tom',
        lastName: 'Ray',
        dateOfBirth: '1990-01-01',
        ...over,
      }) as any;

    it('rejects duplicates and foreign classes or years', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'x' });
      await expect(svc.createTeacher(teacher())).rejects.toThrow('already exists');

      prisma.class.findFirst.mockResolvedValueOnce({ id: 'foreign' });
      await expect(svc.createTeacher(teacher({ classIds: ['c'] }), 's')).rejects.toThrow('Class belongs');

      prisma.academicYear.findFirst.mockResolvedValueOnce({ id: 'foreign' });
      await expect(
        svc.createTeacher(teacher({ newClasses: [{ name: 'A', academicYearId: 'y' }] }), 's'),
      ).rejects.toThrow('Academic year belongs');
    });

    it('creates a teacher assigned to existing classes in the school', async () => {
      prisma.class.findFirst.mockResolvedValueOnce(null);
      await svc.createTeacher(teacher({ classIds: ['c1'], subjects: ['Math'] }), 's');
      expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
        email: 't@x.y',
        name: 'Tom Ray',
        role: Role.TEACHER,
        schoolId: 's',
        subjects: ['Math'],
      });
      expect(prisma.class.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['c1'] } },
        data: { teacherId: 'u' },
      });
      expect(email.sendTempPasswordEmail).toHaveBeenCalled();
    });

    it('emails only after the transaction and returns the password when email fails', async () => {
      const order: string[] = [];
      prisma.$transaction.mockImplementationOnce(async (fn: any) => {
        const result = await fn(prisma);
        order.push('commit');
        return result;
      });
      email.sendTempPasswordEmail.mockImplementationOnce(async () => {
        order.push('email');
        return false;
      });
      const r = await svc.createTeacher(teacher(), 's');
      expect(order).toEqual(['commit', 'email']);
      expect(r).toMatchObject({ id: 'u', emailSent: false, tempPassword: expect.any(String) });
    });

    it('resolves the school from the first class or the first new class year', async () => {
      prisma.class.findFirst.mockResolvedValueOnce({ academicYear: { schoolId: 'from-class' } });
      await svc.createTeacher(teacher({ classIds: ['c1'] }));
      expect(prisma.user.create.mock.calls[0][0].data.schoolId).toBe('from-class');

      prisma.class.findFirst.mockResolvedValueOnce(null);
      await svc.createTeacher(teacher({ classIds: ['c1'] }));
      expect(prisma.user.create.mock.calls[1][0].data.schoolId).toBeUndefined();

      prisma.academicYear.findUnique.mockResolvedValueOnce({ schoolId: 'from-year' });
      prisma.academicYear.findFirst.mockResolvedValue({ id: 'y-default' });
      prisma.series.findFirst.mockResolvedValue({ id: 'se-default' });
      await svc.createTeacher(teacher({ newClasses: [{ name: 'A', academicYearId: 'y1' }] }));
      expect(prisma.user.create.mock.calls[2][0].data.schoolId).toBe('from-year');

      prisma.academicYear.findUnique.mockResolvedValueOnce(null);
      await svc.createTeacher(teacher({ newClasses: [{ name: 'A', academicYearId: 'y1' }] }));
      expect(prisma.user.create.mock.calls[3][0].data.schoolId).toBeUndefined();
    });

    it('creates new classes with school-scoped defaults', async () => {
      prisma.academicYear.findFirst
        .mockResolvedValueOnce(null) // ownership check: no foreign year
        .mockResolvedValue({ id: 'y-default' }); // default year inside the transaction
      prisma.series.findFirst.mockResolvedValue({ id: 'se-default' });
      await svc.createTeacher(
        teacher({
          newClasses: [
            { name: 'A' },
            { name: 'B', level: '2nde', academicYearId: 'y2', seriesId: 'se2' },
          ],
        }),
        's',
      );
      const created = prisma.class.create.mock.calls.map((c: any) => c[0].data);
      expect(created).toEqual([
        { name: 'A', level: '3eme', teacherId: 'u', academicYearId: 'y-default', seriesId: 'se-default' },
        { name: 'B', level: '2nde', teacherId: 'u', academicYearId: 'y2', seriesId: 'se2' },
      ]);
      expect(prisma.academicYear.findFirst.mock.calls[1][0].where).toEqual({ schoolId: 's' });
      expect(prisma.series.findFirst.mock.calls[0][0].where).toEqual({ academicYear: { schoolId: 's' } });
    });

    it('uses unscoped defaults without a school and fails when none exist', async () => {
      prisma.academicYear.findFirst.mockResolvedValue({ id: 'y' });
      prisma.series.findFirst.mockResolvedValue({ id: 'se' });
      await svc.createTeacher(teacher({ newClasses: [{ name: 'A' }] }));
      expect(prisma.academicYear.findFirst.mock.calls[0][0].where).toEqual({});
      expect(prisma.series.findFirst.mock.calls[0][0].where).toEqual({});

      prisma.series.findFirst.mockResolvedValue(null);
      await expect(svc.createTeacher(teacher({ newClasses: [{ name: 'A' }] }))).rejects.toThrow(
        'No academic year or series',
      );
      prisma.academicYear.findFirst.mockResolvedValue(null);
      await expect(svc.createTeacher(teacher({ newClasses: [{ name: 'A' }] }))).rejects.toThrow(
        'No academic year or series',
      );
    });
  });

  describe('resendTempPassword', () => {
    it('validates the target user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(svc.resendTempPassword('a@b.c')).rejects.toBeInstanceOf(NotFoundException);
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u', schoolId: 'x', isActive: true, role: Role.STUDENT });
      await expect(svc.resendTempPassword('a@b.c', 's')).rejects.toBeInstanceOf(NotFoundException);
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u', isActive: false, role: Role.STUDENT });
      await expect(svc.resendTempPassword('a@b.c')).rejects.toThrow('inactive');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u', isActive: true, role: Role.ADMIN });
      await expect(svc.resendTempPassword('a@b.c')).rejects.toThrow('only be resent');
    });

    it('resets the password and emails it', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u',
        email: 'a@b.c',
        isActive: true,
        role: Role.TEACHER,
        schoolId: 's',
      });
      const r = await svc.resendTempPassword(' A@B.C ', 's');
      expect(r).toMatchObject({ success: true, email: 'a@b.c' });
      expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ passwordHash: 'hashed', mustChangePassword: true });
      expect(email.sendTempPasswordEmail).toHaveBeenCalled();
      expect(r).not.toHaveProperty('tempPassword');
      prisma.user.findUnique.mockResolvedValue({ id: 'u', email: 'a@b.c', isActive: true, role: Role.STUDENT });
      email.sendTempPasswordEmail.mockResolvedValueOnce(false);
      expect(await svc.resendTempPassword('a@b.c')).toMatchObject({ emailSent: false, tempPassword: expect.any(String) });
    });
  });

  it('lists students and teachers with optional school scope', async () => {
    await svc.findAllStudents('s');
    await svc.findAllStudents();
    await svc.findAllTeachers('s');
    await svc.findAllTeachers();
    const where = prisma.user.findMany.mock.calls.map((c: any) => c[0].where);
    expect(where[0].OR).toHaveLength(2);
    expect(where[1]).toEqual({ role: Role.STUDENT });
    expect(where[2].OR[1]).toEqual({ classesTeaching: { some: { academicYear: { schoolId: 's' } } } });
    expect(where[3]).toEqual({ role: Role.TEACHER });
  });
});
