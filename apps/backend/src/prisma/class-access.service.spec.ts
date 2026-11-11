import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { Role } from '@prisma/client';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { ClassAccessService } from './class-access.service';

const classRow = {
  id: 'c1',
  teacherId: 't1',
  academicYear: { schoolId: 's1' },
};

describe('ClassAccessService', () => {
  let prisma: PrismaMock;
  let service: ClassAccessService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ClassAccessService(prisma as any);
    prisma.class.findUnique.mockResolvedValue(classRow);
  });

  describe('assertCanManageClass', () => {
    it('requires an authenticated user', async () => {
      await expect(service.assertCanManageClass('c1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        service.assertCanManageClass('c1', { role: Role.ADMIN }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws when the class does not exist', async () => {
      prisma.class.findUnique.mockResolvedValue(null);
      await expect(
        service.assertCanManageClass('c1', { sub: 'u', role: Role.OWNER }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets OWNER manage any class', async () => {
      await expect(
        service.assertCanManageClass('c1', { sub: 'o', role: Role.OWNER }),
      ).resolves.toEqual(classRow);
    });

    it('lets a TEACHER manage only own classes', async () => {
      await expect(
        service.assertCanManageClass('c1', { sub: 't1', role: Role.TEACHER }),
      ).resolves.toEqual(classRow);
      await expect(
        service.assertCanManageClass('c1', { sub: 't2', role: Role.TEACHER }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('restricts ADMIN to their own school', async () => {
      await expect(
        service.assertCanManageClass('c1', {
          sub: 'a',
          role: Role.ADMIN,
          schoolId: 's1',
        }),
      ).resolves.toEqual(classRow);
      await expect(
        service.assertCanManageClass('c1', {
          sub: 'a',
          role: Role.ADMIN,
          schoolId: 's2',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects an ADMIN without a school', async () => {
      await expect(
        service.assertCanManageClass('c1', { sub: 'a', role: Role.ADMIN }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects an ADMIN when the class has no academic year', async () => {
      prisma.class.findUnique.mockResolvedValue({ ...classRow, academicYear: null });
      await expect(
        service.assertCanManageClass('c1', {
          sub: 'a',
          role: Role.ADMIN,
          schoolId: 's1',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects other roles', async () => {
      await expect(
        service.assertCanManageClass('c1', { sub: 's', role: Role.STUDENT }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('assertCanViewClass', () => {
    it('lets an enrolled student view the class', async () => {
      prisma.class.findFirst.mockResolvedValue({ id: 'c1' });
      await expect(
        service.assertCanViewClass('c1', { sub: 'st', role: Role.STUDENT }),
      ).resolves.toBeUndefined();
      expect(prisma.class.findFirst).toHaveBeenCalledWith({
        where: { id: 'c1', students: { some: { id: 'st' } } },
        select: { id: true },
      });
    });

    it('rejects a student not enrolled', async () => {
      prisma.class.findFirst.mockResolvedValue(null);
      await expect(
        service.assertCanViewClass('c1', { sub: 'st', role: Role.STUDENT }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('delegates other roles to manage check', async () => {
      await expect(
        service.assertCanViewClass('c1', { sub: 't1', role: Role.TEACHER }),
      ).resolves.toBeUndefined();
      await expect(service.assertCanViewClass('c1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('assertSeriesInSchool', () => {
    it('throws when the series does not exist', async () => {
      prisma.series.findUnique.mockResolvedValue(null);
      await expect(service.assertSeriesInSchool('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('allows the same school or the owner, and rejects users without a school', async () => {
      prisma.series.findUnique.mockResolvedValue({
        academicYear: { schoolId: 's1' },
      });
      await expect(
        service.assertSeriesInSchool('x', { role: Role.ADMIN, schoolId: 's1' }),
      ).resolves.toBeUndefined();
      await expect(
        service.assertSeriesInSchool('x', { role: Role.OWNER, schoolId: 's2' }),
      ).resolves.toBeUndefined();
      await expect(
        service.assertSeriesInSchool('x', { role: Role.ADMIN }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.assertSeriesInSchool('x')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a series from another school', async () => {
      prisma.series.findUnique.mockResolvedValue({
        academicYear: { schoolId: 's1' },
      });
      await expect(
        service.assertSeriesInSchool('x', { role: Role.ADMIN, schoolId: 's2' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      prisma.series.findUnique.mockResolvedValue({ academicYear: null });
      await expect(
        service.assertSeriesInSchool('x', { role: Role.ADMIN, schoolId: 's2' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('assertDisciplineInSchool', () => {
    it('throws when the discipline does not exist', async () => {
      prisma.discipline.findUnique.mockResolvedValue(null);
      await expect(
        service.assertDisciplineInSchool('d'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('checks the series of the discipline', async () => {
      prisma.discipline.findUnique.mockResolvedValue({ seriesId: 'se1' });
      prisma.series.findUnique.mockResolvedValue({
        academicYear: { schoolId: 's1' },
      });
      await expect(
        service.assertDisciplineInSchool('d', { schoolId: 's1' }),
      ).resolves.toBeUndefined();
      expect(prisma.series.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'se1' } }),
      );
    });
  });

  const teacher = { sub: 't1', role: Role.TEACHER };

  describe('assertCanManageGrade', () => {
    it('throws when grade missing', async () => {
      prisma.grade.findUnique.mockResolvedValue(null);
      await expect(
        service.assertCanManageGrade('g', teacher),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('checks the class of the grade', async () => {
      prisma.grade.findUnique.mockResolvedValue({ classId: 'c1' });
      await expect(
        service.assertCanManageGrade('g', teacher),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertCanManageAssignment', () => {
    it('throws when assignment missing', async () => {
      prisma.assignment.findUnique.mockResolvedValue(null);
      await expect(
        service.assertCanManageAssignment('a', teacher),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('checks the class of the assignment', async () => {
      prisma.assignment.findUnique.mockResolvedValue({ classId: 'c1' });
      await expect(
        service.assertCanManageAssignment('a', teacher),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertCanManageSubmission', () => {
    it('throws when submission missing or from another assignment', async () => {
      prisma.assignmentSubmission.findUnique.mockResolvedValue(null);
      await expect(
        service.assertCanManageSubmission('a', 's', teacher),
      ).rejects.toBeInstanceOf(NotFoundException);
      prisma.assignmentSubmission.findUnique.mockResolvedValue({
        assignmentId: 'other',
      });
      await expect(
        service.assertCanManageSubmission('a', 's', teacher),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('checks the assignment of the submission', async () => {
      prisma.assignmentSubmission.findUnique.mockResolvedValue({
        assignmentId: 'a',
      });
      prisma.assignment.findUnique.mockResolvedValue({ classId: 'c1' });
      await expect(
        service.assertCanManageSubmission('a', 's', teacher),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertCanManageResource', () => {
    it('throws when resource missing', async () => {
      prisma.resource.findUnique.mockResolvedValue(null);
      await expect(
        service.assertCanManageResource('r', teacher),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('checks the class of the resource', async () => {
      prisma.resource.findUnique.mockResolvedValue({ classId: 'c1' });
      await expect(
        service.assertCanManageResource('r', teacher),
      ).resolves.toBeUndefined();
    });
  });
});
