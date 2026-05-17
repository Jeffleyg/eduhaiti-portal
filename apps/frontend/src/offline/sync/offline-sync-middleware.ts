import { OfflineFirstSyncEngine } from "./sync-engine"
import { SyncEntity, SyncOperation } from "./types"

const NON_SYNCABLE_ENTITIES = new Set<SyncEntity>(["grade", "attendance"])

interface MutationEnvelope {
  entityType: SyncEntity
  entityId: string
  operation: SyncOperation
  payload?: Record<string, unknown>
}

/**
 * Middleware-like wrapper for mobile screens/services:
 * every write is persisted to local outbox first, then synced in background.
 */
export class OfflineSyncMiddleware {
  constructor(private readonly engine: OfflineFirstSyncEngine) {}

  async captureMutation(envelope: MutationEnvelope): Promise<{ queued: true; actionId: string }> {
    if (NON_SYNCABLE_ENTITIES.has(envelope.entityType)) {
      throw new Error(`Offline sync is disabled for ${envelope.entityType}`)
    }

    const actionId = crypto.randomUUID()

    await this.engine.enqueueAction({
      actionId,
      entityType: envelope.entityType,
      entityId: envelope.entityId,
      operation: envelope.operation,
      payload: envelope.payload,
    })

    return {
      queued: true,
      actionId,
    }
  }
}
