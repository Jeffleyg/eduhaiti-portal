import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Role } from '@prisma/client';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { ConflictResolverService } from './services/conflict-resolver.service';
import { SyncService } from './sync.service';

describe('SyncService', () => {
  let prisma: PrismaMock;
  let audit: { write: jest.Mock<(...a: any[]) => Promise<void>>; isProcessed: jest.Mock<(id: string) => boolean> };
  let svc: SyncService;
  const ctx = { userId: 'u', role: Role.TEACHER, schoolId: 's' };
  const action = (over: Record<string, unknown> = {}) =>
    ({
      actionId: 'a1',
      entityType: 'class',
      entityId: 'e1',
      operation: 'upsert',
      payload: { name: 'N' },
      clientTimestamp: '2026-01-02T00:00:00Z',
      ...over,
    }) as any;
  const push = (...actions: any[]) => svc.push({ deviceId: 'd', actions } as any, ctx as any);

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { write: jest.fn(async () => undefined), isProcessed: jest.fn(() => false) };
    svc = new SyncService(prisma as any, audit as any, new ConflictResolverService());
    prisma.class.findFirst.mockResolvedValue(null);
    prisma.class.findUnique.mockResolvedValue(null);
  });

  describe('push', () => {
    it('ignores non-syncable and duplicate actions', async () => {
      audit.isProcessed.mockImplementation((id) => id === 'dup');
      const r = await push(action({ entityType: 'grade' }), action({ actionId: 'dup' }));
      expect(r.results.map((x) => [x.status, x.message])).toEqual([
        ['ignored', 'Offline sync is disabled for this entity'],
        ['ignored', 'Duplicate action was ignored'],
      ]);
      expect(audit.write).toHaveBeenCalledTimes(2);
    });

    it('rejects records owned by another school', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'e1' });
      const r = await push(action());
      expect(r.results[0]).toEqual({
        actionId: 'a1',
        status: 'ignored',
        message: 'Record does not belong to your school',
      });
      expect(audit.write.mock.calls[0][0]).toMatchObject({ message: expect.stringContaining('Forbidden for user u') });
    });

    it('applies deletes for existing and missing records', async () => {
      prisma.class.findFirst.mockResolvedValueOnce({ id: 'e1' }).mockResolvedValueOnce(null);
      const r = await push(action({ operation: 'delete' }), action({ actionId: 'a2', operation: 'delete' }));
      expect(r.results.map((x) => x.status)).toEqual(['applied', 'applied']);
      expect(prisma.class.delete).toHaveBeenCalledTimes(1);
    });

    it('keeps newer server data (last write wins)', async () => {
      const existing = { id: 'e1', updatedAt: new Date('2026-02-01T00:00:00Z') };
      prisma.class.findFirst.mockResolvedValue(existing);
      const r = await push(action());
      expect(r.results[0]).toMatchObject({ status: 'conflict', serverRecord: existing });
    });

    it('updates existing records and creates new ones scoped to the school', async () => {
      prisma.academicYear.findFirst.mockResolvedValue({ id: 'y' });
      prisma.class.findFirst.mockResolvedValueOnce({ id: 'e1', updatedAt: 'not-a-date' });
      const r = await push(
        action({ payload: { id: 'forged', name: 'N', academicYearId: 'y' } }),
        action({ actionId: 'a2', entityId: 'e2', payload: undefined }),
      );
      expect(r.results.map((x) => x.status)).toEqual(['applied', 'applied']);
      expect(prisma.class.update.mock.calls[0][0]).toEqual({
        where: { id: 'e1' },
        data: { name: 'N', academicYearId: 'y' },
      });
      expect(prisma.class.create.mock.calls[0][0]).toEqual({ data: { id: 'e2' } });
      expect(prisma.class.findFirst.mock.calls[0][0].where).toEqual({
        id: 'e1',
        academicYear: { schoolId: 's' },
      });
    });

    it('forces the school on announcements', async () => {
      prisma.announcement.findFirst.mockResolvedValue(null);
      prisma.announcement.findUnique.mockResolvedValue(null);
      await push(action({ entityType: 'announcement', payload: { title: 't', schoolId: 'evil' } }));
      expect(prisma.announcement.create.mock.calls[0][0].data).toMatchObject({ schoolId: 's', id: 'e1' });
      expect(prisma.announcement.findFirst.mock.calls[0][0].where).toEqual({ id: 'e1', schoolId: 's' });
    });

    it('validates foreign keys in payloads', async () => {
      prisma.resource.findFirst.mockResolvedValue(null);
      prisma.resource.findUnique.mockResolvedValue(null);
      prisma.assignment.findFirst.mockResolvedValue(null);
      prisma.assignment.findUnique.mockResolvedValue(null);
      prisma.academicYear.findFirst.mockResolvedValueOnce(null);
      prisma.class.findFirst.mockResolvedValue(null);

      const r = await push(
        action({ payload: { academicYearId: 'foreign' } }),
        action({ actionId: 'r', entityType: 'resource', payload: { classId: 'foreign' } }),
        action({ actionId: 'as', entityType: 'assignment', payload: { classId: '' } }),
        action({ actionId: 'ok', entityType: 'resource', payload: { title: 'no class' } }),
      );
      expect(r.results.map((x) => [x.status, x.message])).toEqual([
        ['ignored', 'Academic year does not belong to your school'],
        ['ignored', 'Class does not belong to your school'],
        ['ignored', 'Invalid reference id in payload'],
        ['applied', 'Upsert applied'],
      ]);

      prisma.class.findFirst.mockResolvedValue({ id: 'c' });
      prisma.assignment.findFirst.mockResolvedValue(null);
      const ok = await push(action({ actionId: 'as2', entityType: 'assignment', payload: { classId: 'c' } }));
      expect(ok.results[0].status).toBe('applied');
    });

    it('reports unexpected failures', async () => {
      prisma.class.findFirst.mockRejectedValueOnce(new Error('db down')).mockRejectedValueOnce('weird');
      const r = await push(action(), action({ actionId: 'a2' }));
      expect(r.results.map((x) => [x.status, x.message])).toEqual([
        ['failed', 'db down'],
        ['failed', 'Unknown sync error'],
      ]);
    });
  });

  describe('pull', () => {
    it('returns school-scoped deltas for syncable entities', async () => {
      prisma.class.findMany.mockResolvedValue([{ id: 'c' }]);
      const r = await svc.pull({ since: '2026-01-01T00:00:00Z' } as any, ctx as any);
      expect(r.deltas.map((d) => d.entityType)).toEqual(['class', 'resource', 'assignment', 'announcement']);
      expect(prisma.class.findMany.mock.calls[0][0]).toMatchObject({
        where: { updatedAt: { gt: new Date('2026-01-01T00:00:00Z') }, academicYear: { schoolId: 's' } },
        take: 200,
      });
    });

    it('honours entity selection and limit', async () => {
      const r = await svc.pull({ since: '2026-01-01', entities: ['grade', 'resource'], limit: 5 } as any, ctx as any);
      expect(r.deltas.map((d) => d.entityType)).toEqual(['resource']);
      expect(prisma.resource.findMany.mock.calls[0][0].take).toBe(5);
    });
  });

  it('refuses to scope non-syncable entities', () => {
    expect(() => (svc as any).schoolScope('grade', 's')).toThrow('Entity is not syncable');
  });
});
