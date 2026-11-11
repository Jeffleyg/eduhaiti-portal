import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { Role } from '@prisma/client';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { ClassesService } from './classes.service';

describe('ClassesService', () => {
  let prisma: PrismaMock;
  let svc: ClassesService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new ClassesService(prisma as any);
  });

  describe('create', () => {
    const payload = { name: 'A', academicYearId: 'y', seriesId: 'se' };
    const series = { id: 'se', name: '3e', academicYearId: 'y', academicYear: { schoolId: 's' } };

    it('validates year, series and duplicates', async () => {
      prisma.academicYear.findUnique.mockResolvedValueOnce(null);
      await expect(svc.create(payload)).rejects.toBeInstanceOf(NotFoundException);

      prisma.academicYear.findUnique.mockResolvedValue({ id: 'y', schoolId: 's' });
      await expect(svc.create(payload, 'other')).rejects.toBeInstanceOf(ForbiddenException);

      prisma.series.findUnique.mockResolvedValueOnce(null);
      await expect(svc.create(payload)).rejects.toBeInstanceOf(BadRequestException);
      prisma.series.findUnique.mockResolvedValueOnce({ ...series, academicYearId: 'z' });
      await expect(svc.create(payload)).rejects.toBeInstanceOf(BadRequestException);

      prisma.academicYear.findUnique.mockResolvedValue({ id: 'y', schoolId: 'x' });
      prisma.series.findUnique.mockResolvedValueOnce(series);
      await expect(svc.create(payload, 'x')).rejects.toThrow('Series does not belong');

      prisma.academicYear.findUnique.mockResolvedValue({ id: 'y', schoolId: 's' });
      prisma.series.findUnique.mockResolvedValue(series);
      prisma.class.findFirst.mockResolvedValueOnce({ id: 'dup' });
      await expect(svc.create(payload, 's')).rejects.toThrow('already exists');
    });

    it('creates with defaults or explicit values', async () => {
      prisma.academicYear.findUnique.mockResolvedValue({ id: 'y', schoolId: 's' });
      prisma.series.findUnique.mockResolvedValue(series);
      prisma.class.findFirst.mockResolvedValue(null);
      await svc.create(payload, 's');
      await svc.create({ ...payload, level: '2nde', teacherId: 't', maxStudents: 20 });
      const data = prisma.class.create.mock.calls.map((c: any) => c[0].data);
      expect(data[0]).toMatchObject({ level: '3e', maxStudents: 30, teacherId: undefined });
      expect(data[1]).toMatchObject({ level: '2nde', maxStudents: 20, teacherId: 't' });
    });
  });

  describe('update', () => {
    const existing = { id: 'c', name: 'A', academicYearId: 'y', seriesId: 'se', academicYear: { schoolId: 's' } };

    it('validates the class, name, teacher and capacity', async () => {
      prisma.class.findUnique.mockResolvedValueOnce(null);
      await expect(svc.update('c', {})).rejects.toBeInstanceOf(NotFoundException);

      prisma.class.findUnique.mockResolvedValue(existing);
      await expect(svc.update('c', {}, 'other')).rejects.toBeInstanceOf(ForbiddenException);

      prisma.class.findFirst.mockResolvedValueOnce({ id: 'dup' });
      await expect(svc.update('c', { name: 'B' })).rejects.toThrow('already exists');

      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(svc.update('c', { teacherId: 't' })).rejects.toThrow('Teacher not found');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 't', role: Role.STUDENT });
      await expect(svc.update('c', { teacherId: 't' })).rejects.toThrow('Teacher not found');

      await expect(svc.update('c', { maxStudents: 0 })).rejects.toThrow('greater than zero');
    });

    it('updates when valid', async () => {
      prisma.class.findUnique.mockResolvedValue(existing);
      prisma.class.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ id: 't', role: Role.TEACHER });
      await svc.update('c', { name: 'B', teacherId: 't', maxStudents: 10 }, 's');
      await svc.update('c', { name: 'A' });
      expect(prisma.class.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.class.update.mock.calls[0][0].data).toEqual({ name: 'B', teacherId: 't', maxStudents: 10 });
    });
  });

  describe('delete', () => {
    it('protects classes with students or other schools', async () => {
      prisma.class.findUnique.mockResolvedValueOnce(null);
      await expect(svc.delete('c')).rejects.toBeInstanceOf(NotFoundException);
      prisma.class.findUnique.mockResolvedValueOnce({ students: [], academicYear: { schoolId: 's' } });
      await expect(svc.delete('c', 'x')).rejects.toBeInstanceOf(ForbiddenException);
      prisma.class.findUnique.mockResolvedValueOnce({ students: [{ id: 'st' }], academicYear: { schoolId: 's' } });
      await expect(svc.delete('c')).rejects.toThrow('enrolled students');
    });

    it('deletes empty classes', async () => {
      prisma.class.findUnique.mockResolvedValueOnce({ students: [], academicYear: { schoolId: 's' } });
      await expect(svc.delete('c', 's')).resolves.toEqual({ message: 'Class deleted successfully' });
      prisma.class.findUnique.mockResolvedValueOnce({ students: null, academicYear: { schoolId: 's' } });
      await expect(svc.delete('c')).resolves.toBeDefined();
    });
  });

  describe('enrollment', () => {
    const cls = (over: Record<string, unknown> = {}) => ({
      maxStudents: 2,
      students: [{ id: 'a' }],
      academicYear: { schoolId: 's' },
      ...over,
    });

    it('validates enrollment', async () => {
      prisma.class.findUnique.mockResolvedValueOnce(null);
      await expect(svc.enrollStudent('c', 'b')).rejects.toBeInstanceOf(NotFoundException);
      prisma.class.findUnique.mockResolvedValueOnce(cls());
      await expect(svc.enrollStudent('c', 'b', 'x')).rejects.toBeInstanceOf(ForbiddenException);
      prisma.class.findUnique.mockResolvedValueOnce(cls({ students: [{ id: 'a' }, { id: 'c' }] }));
      await expect(svc.enrollStudent('c', 'b')).rejects.toThrow('full');
      prisma.class.findUnique.mockResolvedValueOnce(cls());
      await expect(svc.enrollStudent('c', 'a')).rejects.toThrow('already enrolled');
    });

    it('enrolls with or without capacity limits', async () => {
      prisma.class.findUnique.mockResolvedValueOnce(cls());
      await svc.enrollStudent('c', 'b', 's');
      prisma.class.findUnique.mockResolvedValueOnce(cls({ maxStudents: null, students: [{ id: 'a' }, { id: 'c' }] }));
      await svc.enrollStudent('c', 'b');
      expect(prisma.class.update.mock.calls[0][0].data).toEqual({ students: { connect: { id: 'b' } } });
    });

    it('removes students', async () => {
      prisma.class.findUnique.mockResolvedValueOnce(null);
      await expect(svc.removeStudent('c', 'a')).rejects.toBeInstanceOf(NotFoundException);
      prisma.class.findUnique.mockResolvedValue({ id: 'c', academicYear: { schoolId: 's' } });
      await expect(svc.removeStudent('c', 'a', 'x')).rejects.toBeInstanceOf(ForbiddenException);
      await svc.removeStudent('c', 'a', 's');
      await svc.removeStudent('c', 'a');
      expect(prisma.class.update.mock.calls[0][0].data).toEqual({ students: { disconnect: { id: 'a' } } });
    });
  });

  describe('getTeacherSummary', () => {
    it('aggregates attendance, grades and upcoming assignments of own classes', async () => {
      prisma.attendance.count.mockResolvedValueOnce(45).mockResolvedValueOnce(50);
      prisma.grade.count.mockResolvedValueOnce(12).mockResolvedValueOnce(3);
      prisma.assignment.count.mockResolvedValueOnce(2);
      await expect(svc.getTeacherSummary('t')).resolves.toEqual({
        attendanceRate: 90,
        publishedGrades: 12,
        draftGrades: 3,
        upcomingAssignments: 2,
      });
      expect(prisma.attendance.count.mock.calls[0][0].where).toMatchObject({
        class: { teacherId: 't' },
        status: { in: ['PRESENT', 'LATE'] },
      });
      expect(prisma.grade.count.mock.calls.map((c: any) => c[0].where.status)).toEqual(['PUBLISHED', 'DRAFT']);
      expect(prisma.assignment.count.mock.calls[0][0].where.dueDate.gte).toBeInstanceOf(Date);
    });

    it('reports no attendance rate without records', async () => {
      prisma.attendance.count.mockResolvedValue(0);
      prisma.grade.count.mockResolvedValue(0);
      prisma.assignment.count.mockResolvedValue(0);
      expect((await svc.getTeacherSummary('t')).attendanceRate).toBeNull();
    });
  });

  describe('queries', () => {
    it('finds by teacher and student', async () => {
      await svc.findByTeacher('t');
      await svc.findByStudent('s', 'sc');
      await svc.findByStudent('s');
      const where = prisma.class.findMany.mock.calls.map((c: any) => c[0].where);
      expect(where[0]).toEqual({ teacherId: 't' });
      expect(where[1]).toEqual({ students: { some: { id: 's' } }, academicYear: { schoolId: 'sc' } });
      expect(where[2]).toEqual({ students: { some: { id: 's' } } });
    });

    it('filters all classes', async () => {
      await svc.findAll('y', 'se', 's');
      await svc.findAll();
      const where = prisma.class.findMany.mock.calls.map((c: any) => c[0].where);
      expect(where[0]).toEqual({ academicYearId: 'y', seriesId: 'se', academicYear: { schoolId: 's' } });
      expect(where[1]).toEqual({});
    });

    it('finds by id with school isolation', async () => {
      prisma.class.findUnique.mockResolvedValueOnce(null);
      await expect(svc.findById('c')).rejects.toBeInstanceOf(NotFoundException);
      prisma.class.findUnique.mockResolvedValue({ id: 'c', academicYear: { schoolId: 's' } });
      await expect(svc.findById('c', 'x')).rejects.toBeInstanceOf(NotFoundException);
      await expect(svc.findById('c', 's')).resolves.toMatchObject({ id: 'c' });
      await expect(svc.findById('c')).resolves.toMatchObject({ id: 'c' });
      prisma.class.findUnique.mockResolvedValue({ id: 'c', academicYear: null });
      await expect(svc.findById('c', 's')).resolves.toMatchObject({ id: 'c' });
    });

    it('lists academic years and series', async () => {
      await svc.listAcademicYears('s');
      await svc.listAcademicYears();
      await svc.listSeries('y', 's');
      await svc.listSeries();
      expect(prisma.academicYear.findMany.mock.calls.map((c: any) => c[0].where)).toEqual([{ schoolId: 's' }, undefined]);
      expect(prisma.series.findMany.mock.calls.map((c: any) => c[0].where)).toEqual([
        { academicYearId: 'y', academicYear: { schoolId: 's' } },
        {},
      ]);
    });
  });
});
