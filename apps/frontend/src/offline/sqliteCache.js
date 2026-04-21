const SQLITE_HOME_CACHE_KEY = "eduhaiti_sqlite_home_cache_v1"
const SQLITE_SYNC_HISTORY_KEY = "eduhaiti_sqlite_sync_history_v1"

function readStore() {
  try {
    const raw = localStorage.getItem(SQLITE_HOME_CACHE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(nextStore) {
  localStorage.setItem(SQLITE_HOME_CACHE_KEY, JSON.stringify(nextStore))
}

function readSyncHistoryStore() {
  try {
    const raw = localStorage.getItem(SQLITE_SYNC_HISTORY_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeSyncHistoryStore(history) {
  localStorage.setItem(SQLITE_SYNC_HISTORY_KEY, JSON.stringify(history))
}

export function readHomeCache(role) {
  const store = readStore()
  const row = store[role]

  if (!row || typeof row !== "object") {
    return {
      data: null,
      lastUpdatedAt: null,
    }
  }

  return {
    data: row.data ?? null,
    lastUpdatedAt: row.lastUpdatedAt ?? null,
  }
}

export function writeHomeCache(role, data) {
  const store = readStore()
  const lastUpdatedAt = new Date().toISOString()

  store[role] = {
    data,
    lastUpdatedAt,
  }

  writeStore(store)
  return lastUpdatedAt
}

export function appendSyncHistory(entry) {
  const history = readSyncHistoryStore()
  const next = [entry, ...history].slice(0, 30)
  writeSyncHistoryStore(next)
}

export function readSyncHistory(limit = 10) {
  return readSyncHistoryStore().slice(0, Math.max(1, limit))
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
