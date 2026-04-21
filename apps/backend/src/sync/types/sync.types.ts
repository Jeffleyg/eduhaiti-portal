export const SYNC_ENTITIES = ["class", "grade", "attendance", "resource", "assignment", "announcement"] as const

export type SyncEntity = (typeof SYNC_ENTITIES)[number]

export const SYNC_OPERATION = ["upsert", "delete"] as const

export type SyncOperation = (typeof SYNC_OPERATION)[number]

export interface OutboxAction {
  actionId: string
  entityType: SyncEntity
  entityId: string
  operation: SyncOperation
  payload?: Record<string, unknown>
  clientTimestamp: string
}

export interface SyncPushRequest {
  deviceId: string
  actions: OutboxAction[]
}

export interface SyncResult {
  actionId: string
  status: "applied" | "ignored" | "conflict" | "failed"
  message?: string
  serverRecord?: unknown
}

export interface EntityDelta {
  entityType: SyncEntity
  records: Array<Record<string, unknown>>
}

export interface SyncPullRequest {
  since: string
  entities?: SyncEntity[]
  limit?: number
}

export interface SyncPullResponse {
  serverTimestamp: string
  deltas: EntityDelta[]
}
