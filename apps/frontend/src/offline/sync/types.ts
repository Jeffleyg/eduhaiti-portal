export type SyncEntity = "class" | "grade" | "attendance" | "resource" | "assignment" | "announcement"

export type SyncOperation = "upsert" | "delete"

export interface LocalOutboxAction {
  actionId: string
  entityType: SyncEntity
  entityId: string
  operation: SyncOperation
  payload?: Record<string, unknown>
  clientTimestamp: string
  attempts: number
  nextRetryAt: string
}

export interface PushPayload {
  deviceId: string
  actions: Array<
    Pick<
      LocalOutboxAction,
      "actionId" | "entityType" | "entityId" | "operation" | "payload" | "clientTimestamp"
    >
  >
}

export interface PushResultItem {
  actionId: string
  status: "applied" | "ignored" | "conflict" | "failed"
  message?: string
  serverRecord?: Record<string, unknown>
}

export interface PushResponse {
  results: PushResultItem[]
  serverTimestamp: string
}

export interface DeltaRecord {
  id: string
  updatedAt: string
  [key: string]: unknown
}

export interface PullResponse {
  serverTimestamp: string
  deltas: Array<{
    entityType: SyncEntity
    records: DeltaRecord[]
  }>
}

export interface AuditLogEntry {
  id: string
  createdAt: string
  eventType: "enqueue" | "push_success" | "push_conflict" | "push_failed" | "pull_applied"
  actionId?: string
  payloadJson: string
}

export interface SyncRemoteApi {
  push(payload: PushPayload): Promise<PushResponse>
  pull(sinceIso: string, entities?: SyncEntity[]): Promise<PullResponse>
}

export interface SqliteExecutor {
  execute(sql: string, params?: unknown[]): Promise<void>
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
}
