import { AuditLogEntry, LocalOutboxAction, SqliteExecutor, SyncEntity, SyncOperation } from "./types"

interface RawOutboxRow {
  action_id: string
  entity_type: SyncEntity
  entity_id: string
  operation: SyncOperation
  payload_json: string | null
  client_timestamp: string
  attempts: number
  next_retry_at: string
}

interface RawStateRow {
  key_name: string
  value_text: string
}

export class SyncSqliteStore {
  constructor(private readonly db: SqliteExecutor) {}

  async bootstrap(): Promise<void> {
    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS sync_outbox (
        action_id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload_json TEXT,
        client_timestamp TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_retry_at TEXT NOT NULL
      )`,
    )

    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS sync_audit_log (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        event_type TEXT NOT NULL,
        action_id TEXT,
        payload_json TEXT NOT NULL
      )`,
    )

    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS sync_state (
        key_name TEXT PRIMARY KEY,
        value_text TEXT NOT NULL
      )`,
    )
  }

  async enqueue(action: Omit<LocalOutboxAction, "attempts" | "nextRetryAt">): Promise<void> {
    const nowIso = new Date().toISOString()

    await this.db.execute(
      `INSERT OR REPLACE INTO sync_outbox (
        action_id,
        entity_type,
        entity_id,
        operation,
        payload_json,
        client_timestamp,
        attempts,
        next_retry_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        action.actionId,
        action.entityType,
        action.entityId,
        action.operation,
        action.payload ? JSON.stringify(action.payload) : null,
        action.clientTimestamp,
        nowIso,
      ],
    )

    await this.writeAudit({
      id: crypto.randomUUID(),
      createdAt: nowIso,
      eventType: "enqueue",
      actionId: action.actionId,
      payloadJson: JSON.stringify(action),
    })
  }

  async listReadyBatch(limit: number): Promise<LocalOutboxAction[]> {
    const nowIso = new Date().toISOString()

    const rows = await this.db.query<RawOutboxRow>(
      `SELECT action_id, entity_type, entity_id, operation, payload_json, client_timestamp, attempts, next_retry_at
       FROM sync_outbox
       WHERE next_retry_at <= ?
       ORDER BY client_timestamp ASC
       LIMIT ?`,
      [nowIso, limit],
    )

    return rows.map((row) => ({
      actionId: row.action_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operation: row.operation,
      payload: row.payload_json ? (JSON.parse(row.payload_json) as Record<string, unknown>) : undefined,
      clientTimestamp: row.client_timestamp,
      attempts: row.attempts,
      nextRetryAt: row.next_retry_at,
    }))
  }

  async removeFromOutbox(actionId: string): Promise<void> {
    await this.db.execute(`DELETE FROM sync_outbox WHERE action_id = ?`, [actionId])
  }

  async scheduleRetry(actionId: string, attempts: number, nextRetryAt: string): Promise<void> {
    await this.db.execute(
      `UPDATE sync_outbox
       SET attempts = ?, next_retry_at = ?
       WHERE action_id = ?`,
      [attempts, nextRetryAt, actionId],
    )
  }

  async getCheckpoint(): Promise<string> {
    const rows = await this.db.query<RawStateRow>(`SELECT key_name, value_text FROM sync_state WHERE key_name = ?`, [
      "last_server_sync_at",
    ])

    if (!rows[0]) {
      return new Date(0).toISOString()
    }

    return rows[0].value_text
  }

  async setCheckpoint(isoTimestamp: string): Promise<void> {
    await this.db.execute(`INSERT OR REPLACE INTO sync_state (key_name, value_text) VALUES (?, ?)`, [
      "last_server_sync_at",
      isoTimestamp,
    ])
  }

  async writeAudit(entry: AuditLogEntry): Promise<void> {
    await this.db.execute(
      `INSERT OR REPLACE INTO sync_audit_log (id, created_at, event_type, action_id, payload_json)
       VALUES (?, ?, ?, ?, ?)`,
      [entry.id, entry.createdAt, entry.eventType, entry.actionId ?? null, entry.payloadJson],
    )
  }
}
