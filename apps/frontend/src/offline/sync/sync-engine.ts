import { SyncSqliteStore } from "./sqlite-store"
import {
  DeltaRecord,
  LocalOutboxAction,
  PushResultItem,
  SyncEntity,
  SyncRemoteApi,
} from "./types"

interface SyncEngineOptions {
  deviceId: string
  maxBatchSize?: number
  baseRetryMs?: number
  maxRetryMs?: number
  syncIntervalMs?: number
  onApplyRemoteDelta: (entity: SyncEntity, records: DeltaRecord[]) => Promise<void>
}

function computeBackoffMs(attempt: number, baseRetryMs: number, maxRetryMs: number): number {
  const pure = Math.min(baseRetryMs * 2 ** attempt, maxRetryMs)
  const jitter = Math.floor(Math.random() * Math.max(250, Math.floor(pure * 0.1)))
  return pure + jitter
}

export class OfflineFirstSyncEngine {
  private readonly maxBatchSize: number
  private readonly baseRetryMs: number
  private readonly maxRetryMs: number
  private readonly syncIntervalMs: number
  private timer: ReturnType<typeof setTimeout> | null = null
  private online = true
  private busy = false

  constructor(
    private readonly store: SyncSqliteStore,
    private readonly api: SyncRemoteApi,
    private readonly options: SyncEngineOptions,
  ) {
    this.maxBatchSize = options.maxBatchSize ?? 50
    this.baseRetryMs = options.baseRetryMs ?? 2_000
    this.maxRetryMs = options.maxRetryMs ?? 60_000
    this.syncIntervalMs = options.syncIntervalMs ?? 15_000
  }

  async bootstrap(): Promise<void> {
    await this.store.bootstrap()
  }

  setNetworkState(isOnline: boolean): void {
    this.online = isOnline

    if (this.online) {
      void this.syncOnce()
    }
  }

  async enqueueAction(
    action: Omit<LocalOutboxAction, "attempts" | "nextRetryAt" | "clientTimestamp"> & {
      clientTimestamp?: string
    },
  ): Promise<void> {
    await this.store.enqueue({
      ...action,
      clientTimestamp: action.clientTimestamp ?? new Date().toISOString(),
    })

    // We sync quickly after enqueue, but still on a timer to avoid battery-draining loops.
    this.scheduleNext(250)
  }

  start(): void {
    this.scheduleNext(this.syncIntervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  async syncOnce(): Promise<void> {
    if (this.busy || !this.online) {
      return
    }

    this.busy = true

    try {
      const batch = await this.store.listReadyBatch(this.maxBatchSize)
      if (batch.length > 0) {
        await this.pushBatch(batch)
      }

      await this.pullDelta()
    } finally {
      this.busy = false
      this.scheduleNext(this.syncIntervalMs)
    }
  }

  private scheduleNext(waitMs: number): void {
    if (this.timer) {
      clearTimeout(this.timer)
    }

    this.timer = setTimeout(() => {
      void this.syncOnce()
    }, waitMs)
  }

  private async pushBatch(batch: LocalOutboxAction[]): Promise<void> {
    const response = await this.api.push({
      deviceId: this.options.deviceId,
      actions: batch.map((item) => ({
        actionId: item.actionId,
        entityType: item.entityType,
        entityId: item.entityId,
        operation: item.operation,
        payload: item.payload,
        clientTimestamp: item.clientTimestamp,
      })),
    })

    const byAction = new Map<string, PushResultItem>()
    for (const item of response.results) {
      byAction.set(item.actionId, item)
    }

    for (const action of batch) {
      const result = byAction.get(action.actionId)

      if (!result || result.status === "failed") {
        await this.scheduleRetry(action)
        continue
      }

      if (result.status === "applied" || result.status === "ignored") {
        await this.store.removeFromOutbox(action.actionId)
        await this.store.writeAudit({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          eventType: "push_success",
          actionId: action.actionId,
          payloadJson: JSON.stringify(result),
        })
        continue
      }

      // LWW conflict on client side: keep whichever version has the latest timestamp.
      if (result.status === "conflict") {
        const resolved = this.resolveConflict(action, result.serverRecord)

        await this.store.writeAudit({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          eventType: "push_conflict",
          actionId: action.actionId,
          payloadJson: JSON.stringify({
            serverRecord: result.serverRecord ?? null,
            localAction: action,
            resolved,
          }),
        })

        await this.store.removeFromOutbox(action.actionId)
      }
    }

    await this.store.setCheckpoint(response.serverTimestamp)
  }

  private async pullDelta(): Promise<void> {
    const since = await this.store.getCheckpoint()
    const response = await this.api.pull(since)

    for (const delta of response.deltas) {
      if (delta.records.length === 0) {
        continue
      }

      await this.options.onApplyRemoteDelta(delta.entityType, delta.records)

      await this.store.writeAudit({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        eventType: "pull_applied",
        payloadJson: JSON.stringify({
          entityType: delta.entityType,
          count: delta.records.length,
        }),
      })
    }

    await this.store.setCheckpoint(response.serverTimestamp)
  }

  private async scheduleRetry(action: LocalOutboxAction): Promise<void> {
    const nextAttempts = action.attempts + 1
    const waitMs = computeBackoffMs(nextAttempts, this.baseRetryMs, this.maxRetryMs)
    const nextRetryAt = new Date(Date.now() + waitMs).toISOString()

    await this.store.scheduleRetry(action.actionId, nextAttempts, nextRetryAt)
    await this.store.writeAudit({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      eventType: "push_failed",
      actionId: action.actionId,
      payloadJson: JSON.stringify({ attempts: nextAttempts, nextRetryAt }),
    })
  }

  private resolveConflict(localAction: LocalOutboxAction, serverRecord?: Record<string, unknown>): "local" | "server" {
    const localTime = Date.parse(localAction.clientTimestamp)
    const rawServerTime = serverRecord?.updatedAt
    const serverTime = typeof rawServerTime === "string" ? Date.parse(rawServerTime) : NaN

    if (!Number.isNaN(localTime) && !Number.isNaN(serverTime)) {
      return localTime >= serverTime ? "local" : "server"
    }

    return "server"
  }
}
