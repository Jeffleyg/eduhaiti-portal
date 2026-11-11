import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { Role } from '@prisma/client';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { ForumsService } from './forums.service';

describe('ForumsService', () => {
  let prisma: PrismaMock;
  let svc: ForumsService;
  const student = { id: 's', role: Role.STUDENT };
  const threadRow = {
    createdAt: new Date('2026-01-01'),
    userId: 'u1',
    changes: { threadId: 'th', classId: 'c', title: 'T', body: 'B' },
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new ForumsService(prisma as any);
    prisma.class.findFirst.mockResolvedValue({ id: 'c' });
    prisma.auditLog.groupBy.mockResolvedValue([]);
  });

  describe('access control', () => {
    it('lets admins without school through and scopes admins with school', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      await svc.listThreads('c', { id: 'a', role: Role.ADMIN });
      expect(prisma.class.findFirst).not.toHaveBeenCalled();

      await svc.listThreads('c', { id: 'a', role: Role.ADMIN, schoolId: 's1' });
      expect(prisma.class.findFirst.mock.calls[0][0].where).toEqual({
        id: 'c',
        academicYear: { schoolId: 's1' },
      });
      prisma.class.findFirst.mockResolvedValueOnce(null);
      await expect(
        svc.listThreads('c', { id: 'a', role: Role.ADMIN, schoolId: 's2' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('requires teachers/students to belong to the class', async () => {
      prisma.class.findFirst.mockResolvedValueOnce(null);
      await expect(svc.listThreads('c', student)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('listThreads', () => {
    it('lists class threads with authors and post counts', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        threadRow,
        { ...threadRow, userId: null, changes: { ...threadRow.changes, threadId: 'th2' } },
        { ...threadRow, userId: 'ghost', changes: { ...threadRow.changes, threadId: 'th3' } },
        { ...threadRow, changes: { ...threadRow.changes, classId: 'other' } },
        { ...threadRow, changes: null },
      ]);
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', name: 'U' }]);
      prisma.auditLog.groupBy.mockResolvedValue([{ entityId: 'th', _count: { _all: 3 } }]);

      const r = await svc.listThreads('c', student);
      expect(r.map((t) => [t.id, t.postsCount, t.createdBy?.id ?? null])).toEqual([
        ['th', 3, 'u1'],
        ['th2', 0, null],
        ['th3', 0, null],
      ]);
    });

    it('skips user lookup when no authors', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      expect(await svc.listThreads('c', student)).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createThread', () => {
    it('validates content', async () => {
      await expect(svc.createThread('c', { title: ' ', body: 'b' }, student)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        svc.createThread('c', { title: 't', body: undefined as any }, student),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        svc.createThread('c', { title: undefined as any, body: 'b' }, student),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stores the thread', async () => {
      const r = await svc.createThread('c', { title: ' T ', body: ' B ' }, student);
      expect(r).toMatchObject({ classId: 'c', title: 'T', body: 'B' });
      expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
        entityType: 'FORUM_THREAD',
        entityId: r.id,
        userId: 's',
      });
    });
  });

  describe('threads and posts', () => {
    it('fails for missing or corrupted threads', async () => {
      prisma.auditLog.findFirst.mockResolvedValueOnce(null);
      await expect(svc.listPosts('th', student)).rejects.toThrow('Forum thread not found');
      prisma.auditLog.findFirst.mockResolvedValueOnce({ ...threadRow, changes: null });
      await expect(svc.createPost('th', { body: 'b' }, student)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lists posts with authors', async () => {
      prisma.auditLog.findFirst.mockResolvedValue(threadRow);
      prisma.auditLog.findMany.mockResolvedValue([
        { createdAt: new Date(), userId: 'u1', changes: { postId: 'p1', threadId: 'th', classId: 'c', body: 'hi' } },
        { createdAt: new Date(), userId: null, changes: { postId: 'p2', threadId: 'th', classId: 'c', body: 'yo' } },
        { createdAt: new Date(), userId: 'ghost', changes: { postId: 'p3', threadId: 'th', classId: 'c', body: '?' } },
        { createdAt: new Date(), userId: 'u1', changes: null },
      ]);
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', name: 'U' }]);
      const r = await svc.listPosts('th', student);
      expect(r.thread).toMatchObject({ id: 'th', title: 'T', createdById: 'u1' });
      expect(r.posts.map((p) => [p.id, p.createdBy?.id ?? null])).toEqual([
        ['p1', 'u1'],
        ['p2', null],
        ['p3', null],
      ]);

      prisma.auditLog.findMany.mockResolvedValue([]);
      expect((await svc.listPosts('th', student)).posts).toEqual([]);
    });

    it('creates posts with validation', async () => {
      prisma.auditLog.findFirst.mockResolvedValue(threadRow);
      await expect(svc.createPost('th', { body: ' ' }, student)).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.createPost('th', { body: undefined as any }, student)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      const r = await svc.createPost('th', { body: ' hello ' }, student);
      expect(r).toMatchObject({ threadId: 'th', classId: 'c', body: 'hello' });
      expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
        entityType: 'FORUM_POST',
        entityId: 'th',
      });
    });
  });
});
