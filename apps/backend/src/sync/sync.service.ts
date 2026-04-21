import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { PullSyncDto } from "./dto/pull-sync.dto"
import { PushSyncDto } from "./dto/push-sync.dto"
import { AuditLogService } from "./services/audit-log.service"
import { ConflictResolverService } from "./services/conflict-resolver.service"
import {
  SYNC_ENTITIES,
  SyncEntity,
  SyncPullResponse,
  SyncResult,
} from "./types/sync.types"

type PrismaDelegate = {
  findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>
  create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  delete: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
}

@Injectable()
export class SyncService {
  private readonly delegateByEntity: Record<SyncEntity, PrismaDelegate>

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
    }
  }

  async push(dto: PushSyncDto): Promise<{ results: SyncResult[]; serverTimestamp: string }> {
    const results: SyncResult[] = []

    for (const action of dto.actions) {
      if (this.auditLog.isProcessed(action.actionId)) {
        await this.auditLog.write({
          actionId: action.actionId,
          deviceId: dto.deviceId,
          entityType: action.entityType,
          entityId: action.entityId,
          status: "ignored",
          timestamp: new Date().toISOString(),
          message: "Duplicate action was ignored",
        })

        results.push({ actionId: action.actionId, status: "ignored", message: "Duplicate action was ignored" })
        continue
      }

      const delegate = this.delegateByEntity[action.entityType]

      try {
        const existing = await delegate.findUnique({ where: { id: action.entityId } })
        const serverUpdatedAt =
          existing && existing.updatedAt instanceof Date ? existing.updatedAt : null

        if (action.operation === "delete") {
          if (existing) {
            await delegate.delete({ where: { id: action.entityId } })
          }

          await this.auditLog.write({
            actionId: action.actionId,
            deviceId: dto.deviceId,
            entityType: action.entityType,
            entityId: action.entityId,
            status: "applied",
            timestamp: new Date().toISOString(),
            message: "Delete applied",
          })

          results.push({ actionId: action.actionId, status: "applied", message: "Delete applied" })
          continue
        }

        const decision = this.conflictResolver.resolveLastWriteWins(serverUpdatedAt, action.clientTimestamp)
        if (decision === "keep-server" && existing) {
          await this.auditLog.write({
            actionId: action.actionId,
            deviceId: dto.deviceId,
            entityType: action.entityType,
            entityId: action.entityId,
            status: "conflict",
            timestamp: new Date().toISOString(),
            message: "Server has newer data (Last Write Wins)",
          })

          results.push({
            actionId: action.actionId,
            status: "conflict",
            message: "Server has newer data (Last Write Wins)",
            serverRecord: existing,
          })
          continue
        }

        const payload = action.payload ?? {}
        if (existing) {
          await delegate.update({
            where: { id: action.entityId },
            data: payload,
          })
        } else {
          await delegate.create({
            data: {
              id: action.entityId,
              ...payload,
            },
          })
        }

        await this.auditLog.write({
          actionId: action.actionId,
          deviceId: dto.deviceId,
          entityType: action.entityType,
          entityId: action.entityId,
          status: "applied",
          timestamp: new Date().toISOString(),
          message: "Upsert applied",
        })

        results.push({ actionId: action.actionId, status: "applied", message: "Upsert applied" })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown sync error"

        await this.auditLog.write({
          actionId: action.actionId,
          deviceId: dto.deviceId,
          entityType: action.entityType,
          entityId: action.entityId,
          status: "failed",
          timestamp: new Date().toISOString(),
          message,
        })

        results.push({ actionId: action.actionId, status: "failed", message })
      }
    }

    return {
      results,
      serverTimestamp: new Date().toISOString(),
    }
  }

  async pull(dto: PullSyncDto): Promise<SyncPullResponse> {
    const since = new Date(dto.since)
    const limit = dto.limit ?? 200
    const selectedEntities = dto.entities && dto.entities.length > 0 ? dto.entities : [...SYNC_ENTITIES]

    const deltas = await Promise.all(
      selectedEntities.map(async (entityType) => {
        const delegate = this.delegateByEntity[entityType]

        // Delta-only fetch keeps payloads tiny for unstable mobile links.
        const records = await delegate.findMany({
          where: { updatedAt: { gt: since } },
          orderBy: { updatedAt: "asc" },
          take: limit,
        })

        return {
          entityType,
          records,
        }
      }),
    )

    return {
      serverTimestamp: new Date().toISOString(),
      deltas,
    }
  }
}
