import { openDatabaseSync } from "expo-sqlite"

const db = openDatabaseSync("eduhaiti_cache.db")

db.execSync(`
  CREATE TABLE IF NOT EXISTS home_cache (
    role TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL,
    last_updated_at TEXT NOT NULL
  );
`)

db.execSync(`
  CREATE TABLE IF NOT EXISTS sync_history (
    id TEXT PRIMARY KEY NOT NULL,
    created_at TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    completed_tasks INTEGER NOT NULL,
    total_tasks INTEGER NOT NULL,
    message TEXT
  );
`)

export function readHomeCache(role) {
  const row = db.getFirstSync(
    "SELECT data, last_updated_at FROM home_cache WHERE role = ? LIMIT 1",
    [role],
  )

  if (!row) {
    return { data: null, lastUpdatedAt: null }
  }

  return {
    data: JSON.parse(row.data),
    lastUpdatedAt: row.last_updated_at,
  }
}

export function writeHomeCache(role, data) {
  const lastUpdatedAt = new Date().toISOString()

  db.runSync(
    `INSERT INTO home_cache (role, data, last_updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(role) DO UPDATE SET
       data = excluded.data,
       last_updated_at = excluded.last_updated_at`,
    [role, JSON.stringify(data), lastUpdatedAt],
  )

  return lastUpdatedAt
}

export function appendSyncHistory(entry) {
  db.runSync(
    `INSERT OR REPLACE INTO sync_history
      (id, created_at, role, status, completed_tasks, total_tasks, message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.createdAt,
      entry.role,
      entry.status,
      entry.completedTasks,
      entry.totalTasks,
      entry.message ?? null,
    ],
  )
}

export function readSyncHistory(limit = 10) {
  const rows = db.getAllSync(
    `SELECT id, created_at, role, status, completed_tasks, total_tasks, message
     FROM sync_history
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit],
  )

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    role: row.role,
    status: row.status,
    completedTasks: row.completed_tasks,
    totalTasks: row.total_tasks,
    message: row.message,
  }))
}

export function formatLastUpdated(iso, language) {
  if (!iso) {
    return "-"
  }

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  const locale = language === "ht" ? "fr-HT" : "fr-FR"
  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
