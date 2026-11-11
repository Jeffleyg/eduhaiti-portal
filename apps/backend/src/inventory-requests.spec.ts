import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { AcademicRequestStatus, Role } from '@prisma/client';
import { createPrismaMock, PrismaMock } from './test-utils/prisma-mock';
import { AcademicRequestsService } from './academic-requests/academic-requests.service';

describe('AcademicRequestsService', () => {
  let prisma: PrismaMock;
  let svc: AcademicRequestsService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new AcademicRequestsService(prisma as any);
  });

  describe('create', () => {
    const dto = (over: Record<string, unknown> = {}) =>
      ({ type: 'GRADE_REVIEW', title: ' T ', details: ' D ', ...over }) as any;

    it('rejects blank text', async () => {
      await expect(svc.create('s', dto({ title: ' ' }))).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.create('s', dto({ details: ' ' }))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('validates the class enrollment', async () => {
      prisma.class.findUnique.mockResolvedValueOnce(null);
      await expect(svc.create('s', dto({ classId: 'c' }))).rejects.toBeInstanceOf(BadRequestException);
      prisma.class.findUnique.mockResolvedValueOnce({ id: 'c', students: [] });
      await expect(svc.create('s', dto({ classId: 'c' }))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates with and without class and audits', async () => {
      prisma.academicRequest.create.mockResolvedValue({ id: 'r1' });
      prisma.class.findUnique.mockResolvedValueOnce({ id: 'c', students: [{ id: 's' }] });
      await svc.create('s', dto({ classId: 'c' }));
      await svc.create('s', dto());
      expect(prisma.academicRequest.create.mock.calls[0][0].data).toMatchObject({ title: 'T', details: 'D', classId: 'c' });
      expect(prisma.auditLog.create.mock.calls.map((c: any) => c[0].data.changes.classId)).toEqual(['c', null]);
    });
  });

  it('lists my requests', async () => {
    await svc.listMine('s');
    expect(prisma.academicRequest.findMany.mock.calls[0][0].where).toEqual({ studentId: 's' });
  });

  describe('listForReview', () => {
    it('scopes admins to their school', async () => {
      await svc.listForReview({ id: 'a', role: Role.ADMIN, schoolId: 's' }, { status: 'PENDING' } as any);
      await svc.listForReview({ id: 'a', role: Role.ADMIN }, {} as any);
      const where = prisma.academicRequest.findMany.mock.calls.map((c: any) => c[0].where);
      expect(where[0]).toEqual({ classId: undefined, status: 'PENDING', student: { schoolId: 's' } });
      expect(where[1]).toEqual({ classId: undefined, status: undefined });
    });

    it('rejects other roles', async () => {
      await expect(svc.listForReview({ id: 'x', role: Role.STUDENT }, {} as any)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('scopes teachers to their classes', async () => {
      prisma.class.findFirst.mockResolvedValueOnce(null);
      await expect(svc.listForReview({ id: 't', role: Role.TEACHER }, { classId: 'c' } as any)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      prisma.class.findFirst.mockResolvedValueOnce({ id: 'c' });
      await svc.listForReview({ id: 't', role: Role.TEACHER }, { classId: 'c' } as any);
      await svc.listForReview({ id: 't', role: Role.TEACHER }, {} as any);
      const where = prisma.academicRequest.findMany.mock.calls.map((c: any) => c[0].where);
      expect(where[0]).toEqual({ classId: 'c', status: undefined, class: { teacherId: 't' } });
      expect(prisma.class.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe('reviewRequest', () => {
    const pending = {
      id: 'r',
      status: AcademicRequestStatus.PENDING,
      class: { id: 'c', teacherId: 't' },
      student: { schoolId: 's' },
    };
    const approve = { status: AcademicRequestStatus.APPROVED } as any;

    it('rejects missing and already reviewed requests', async () => {
      prisma.academicRequest.findUnique.mockResolvedValueOnce(null);
      await expect(svc.reviewRequest('r', { id: 'a', role: Role.ADMIN }, approve)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      prisma.academicRequest.findUnique.mockResolvedValueOnce({ ...pending, status: AcademicRequestStatus.APPROVED });
      await expect(svc.reviewRequest('r', { id: 'a', role: Role.ADMIN }, approve)).rejects.toThrow('already');
    });

    it('authorizes reviewers', async () => {
      prisma.academicRequest.findUnique.mockResolvedValue(pending);
      await expect(svc.reviewRequest('r', { id: 'x', role: Role.TEACHER }, approve)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        svc.reviewRequest('r', { id: 'a', role: Role.ADMIN, schoolId: 'other' }, approve),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.reviewRequest('r', { id: 'x', role: Role.STUDENT }, approve)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      prisma.academicRequest.findUnique.mockResolvedValue({ ...pending, class: null });
      await expect(svc.reviewRequest('r', { id: 't', role: Role.TEACHER }, approve)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('validates the target status and comment', async () => {
      prisma.academicRequest.findUnique.mockResolvedValue(pending);
      await expect(
        svc.reviewRequest('r', { id: 't', role: Role.TEACHER }, { status: AcademicRequestStatus.PENDING } as any),
      ).rejects.toThrow('back to PENDING');
      await expect(
        svc.reviewRequest('r', { id: 't', role: Role.TEACHER }, {
          status: AcademicRequestStatus.REJECTED,
          resolutionComment: '  ',
        } as any),
      ).rejects.toThrow('resolutionComment');
    });

    it('updates and audits the review', async () => {
      prisma.academicRequest.findUnique.mockResolvedValue(pending);
      prisma.academicRequest.update.mockResolvedValue({ id: 'r' });
      await svc.reviewRequest('r', { id: 't', role: Role.TEACHER }, approve);
      await svc.reviewRequest('r', { id: 'a', role: Role.ADMIN, schoolId: 's' }, {
        status: AcademicRequestStatus.REJECTED,
        resolutionComment: ' no ',
      } as any);
      await svc.reviewRequest('r', { id: 'a', role: Role.ADMIN }, { status: AcademicRequestStatus.IN_REVIEW } as any);
      prisma.academicRequest.findUnique.mockResolvedValue({ ...pending, student: null });
      await svc.reviewRequest('r', { id: 'a', role: Role.ADMIN, schoolId: 's' }, approve);

      const data = prisma.academicRequest.update.mock.calls.map((c: any) => c[0].data);
      expect(data[0]).toMatchObject({ status: 'APPROVED', reviewedById: 't', resolutionComment: null });
      expect(data[0].resolvedAt).toBeInstanceOf(Date);
      expect(data[1]).toMatchObject({ status: 'REJECTED', resolutionComment: 'no' });
      expect(data[2].resolvedAt).toBeNull();
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(4);
    });
  });
});
