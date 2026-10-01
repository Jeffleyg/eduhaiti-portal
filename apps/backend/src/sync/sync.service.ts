import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PullSyncDto } from './dto/pull-sync.dto';
import { PushSyncDto } from './dto/push-sync.dto';
import { SyncContext } from './guards/sync-school-access.guard';
import { AuditLogService } from './services/audit-log.service';
import { ConflictResolverService } from './services/conflict-resolver.service';
import {
  SYNC_ENTITIES,
  SyncEntity,
  SyncPullResponse,
  SyncResult,
} from './types/sync.types';

const NON_SYNCABLE_ENTITIES = new Set<SyncEntity>(['grade', 'attendance']);

type PrismaDelegate = {
  findUnique: (
    args: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
  findFirst: (
    args: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
  findMany: (
    args: Record<string, unknown>,
  ) => Promise<Array<Record<string, unknown>>>;
  create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  delete: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

// Syncable entities have no direct schoolId (except announcement), so the
// school is reached through Class -> AcademicYear.
const schoolScopeByEntity: Partial<
  Record<SyncEntity, (schoolId: string) => Record<string, unknown>>
> = {
  class: (schoolId) => ({ academicYear: { schoolId } }),
  resource: (schoolId) => ({ class: { academicYear: { schoolId } } }),
  assignment: (schoolId) => ({ class: { academicYear: { schoolId } } }),
  announcement: (schoolId) => ({ schoolId }),
};

class SyncForbiddenError extends Error {}

@Injectable()
export class SyncService {
  private readonly delegateByEntity: Record<SyncEntity, PrismaDelegate>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly conflictResolver: ConflictResolverService,
  ) {
    this.delegateByEntity = {
      class: this.prisma.class as unknown as PrismaDelegate,
      grade: this.prisma.grade as unknown as PrismaDelegate,
      attendance: this.prisma.attendance as unknown as PrismaDelegate,
      resource: this.prisma.resource as unknown as PrismaDelegate,
      assignment: this.prisma.assignment as unknown as PrismaDelegate,
      announcement: this.prisma.announcement as unknown as PrismaDelegate,
    };
  }

  async push(
    dto: PushSyncDto,
    ctx: SyncContext,
  ): Promise<{ results: SyncResult[]; serverTimestamp: string }> {
    const results: SyncResult[] = [];

    for (const action of dto.actions) {
      if (NON_SYNCABLE_ENTITIES.has(action.entityType)) {
        await this.auditLog.write({
          actionId: action.actionId,
          deviceId: dto.deviceId,
          entityType: action.entityType,
          entityId: action.entityId,
          status: 'ignored',
          timestamp: new Date().toISOString(),
          message: 'Offline sync is disabled for this entity',
        });

        results.push({
          actionId: action.actionId,
          status: 'ignored',
          message: 'Offline sync is disabled for this entity',
        });

        continue;
      }

      if (this.auditLog.isProcessed(action.actionId)) {
        await this.auditLog.write({
          actionId: action.actionId,
          deviceId: dto.deviceId,
          entityType: action.entityType,
          entityId: action.entityId,
          status: 'ignored',
          timestamp: new Date().toISOString(),
          message: 'Duplicate action was ignored',
        });

        results.push({
          actionId: action.actionId,
          status: 'ignored',
          message: 'Duplicate action was ignored',
        });
        continue;
      }

      const delegate = this.delegateByEntity[action.entityType];

      try {
        const existing = await delegate.findFirst({
          where: {
            id: action.entityId,
            ...this.schoolScope(action.entityType, ctx.schoolId),
          },
        });

        if (!existing) {
          const foreign = await delegate.findUnique({
            where: { id: action.entityId },
          });
          if (foreign) {
            throw new SyncForbiddenError(
              'Record does not belong to your school',
            );
          }
        }
        const serverUpdatedAt =
          existing && existing.updatedAt instanceof Date
            ? existing.updatedAt
            : null;

        if (action.operation === 'delete') {
          if (existing) {
            await delegate.delete({ where: { id: action.entityId } });
          }

          await this.auditLog.write({
            actionId: action.actionId,
            deviceId: dto.deviceId,
            entityType: action.entityType,
            entityId: action.entityId,
            status: 'applied',
            timestamp: new Date().toISOString(),
            message: 'Delete applied',
          });

          results.push({
            actionId: action.actionId,
            status: 'applied',
            message: 'Delete applied',
          });
          continue;
        }

        const decision = this.conflictResolver.resolveLastWriteWins(
          serverUpdatedAt,
          action.clientTimestamp,
        );
        if (decision === 'keep-server' && existing) {
          await this.auditLog.write({
            actionId: action.actionId,
            deviceId: dto.deviceId,
            entityType: action.entityType,
            entityId: action.entityId,
            status: 'conflict',
            timestamp: new Date().toISOString(),
            message: 'Server has newer data (Last Write Wins)',
          });

          results.push({
            actionId: action.actionId,
            status: 'conflict',
            message: 'Server has newer data (Last Write Wins)',
            serverRecord: existing,
          });
          continue;
        }

        const payload = await this.buildSchoolSafePayload(
          action.entityType,
          action.payload ?? {},
          ctx.schoolId,
        );
        if (existing) {
          await delegate.update({
            where: { id: action.entityId },
            data: payload,
          });
        } else {
          await delegate.create({
            data: {
              ...payload,
              id: action.entityId,
            },
          });
        }

        await this.auditLog.write({
          actionId: action.actionId,
          deviceId: dto.deviceId,
          entityType: action.entityType,
          entityId: action.entityId,
          status: 'applied',
          timestamp: new Date().toISOString(),
          message: 'Upsert applied',
        });

        results.push({
          actionId: action.actionId,
          status: 'applied',
          message: 'Upsert applied',
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown sync error';

        if (error instanceof SyncForbiddenError) {
          await this.auditLog.write({
            actionId: action.actionId,
            deviceId: dto.deviceId,
            entityType: action.entityType,
            entityId: action.entityId,
            status: 'ignored',
            timestamp: new Date().toISOString(),
            message: `Forbidden for user ${ctx.userId}: ${message}`,
          });

          results.push({
            actionId: action.actionId,
            status: 'ignored',
            message,
          });
          continue;
        }

        await this.auditLog.write({
          actionId: action.actionId,
          deviceId: dto.deviceId,
          entityType: action.entityType,
          entityId: action.entityId,
          status: 'failed',
          timestamp: new Date().toISOString(),
          message,
        });

        results.push({ actionId: action.actionId, status: 'failed', message });
      }
    }

    return {
      results,
      serverTimestamp: new Date().toISOString(),
    };
  }

  async pull(dto: PullSyncDto, ctx: SyncContext): Promise<SyncPullResponse> {
    const since = new Date(dto.since);
    const limit = dto.limit ?? 200;
    const selectedEntities =
      dto.entities && dto.entities.length > 0
        ? dto.entities
        : [...SYNC_ENTITIES];
    const syncableEntities = selectedEntities.filter(
      (entityType) => !NON_SYNCABLE_ENTITIES.has(entityType),
    );

    const deltas = await Promise.all(
      syncableEntities.map(async (entityType) => {
        const delegate = this.delegateByEntity[entityType];

        // Delta-only fetch keeps payloads tiny for unstable mobile links.
        const records = await delegate.findMany({
          where: {
            updatedAt: { gt: since },
            ...this.schoolScope(entityType, ctx.schoolId),
          },
          orderBy: { updatedAt: 'asc' },
          take: limit,
        });

        return {
          entityType,
          records,
        };
      }),
    );

    return {
      serverTimestamp: new Date().toISOString(),
      deltas,
    };
  }

  private schoolScope(
    entityType: SyncEntity,
    schoolId: string,
  ): Record<string, unknown> {
    const scope = schoolScopeByEntity[entityType];
    if (!scope) {
      throw new SyncForbiddenError('Entity is not syncable');
    }
    return scope(schoolId);
  }

  /**
   * Prevents a client from creating or moving a record into another school by
   * forging foreign keys in the payload.
   */
  private async buildSchoolSafePayload(
    entityType: SyncEntity,
    payload: Record<string, unknown>,
    schoolId: string,
  ): Promise<Record<string, unknown>> {
    const safePayload: Record<string, unknown> = { ...payload };
    delete safePayload.id;

    if (entityType === 'announcement') {
      safePayload.schoolId = schoolId;
      return safePayload;
    }

    if (entityType === 'class' && safePayload.academicYearId !== undefined) {
      const academicYear = await this.prisma.academicYear.findFirst({
        where: { id: this.requireId(safePayload.academicYearId), schoolId },
        select: { id: true },
      });
      if (!academicYear) {
        throw new SyncForbiddenError(
          'Academic year does not belong to your school',
        );
      }
    }

    if (
      (entityType === 'resource' || entityType === 'assignment') &&
      safePayload.classId !== undefined
    ) {
      const targetClass = await this.prisma.class.findFirst({
        where: {
          id: this.requireId(safePayload.classId),
          academicYear: { schoolId },
        },
        select: { id: true },
      });
      if (!targetClass) {
        throw new SyncForbiddenError('Class does not belong to your school');
      }
    }

    return safePayload;
  }

  private requireId(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new SyncForbiddenError('Invalid reference id in payload');
    }
    return value;
  }
}
