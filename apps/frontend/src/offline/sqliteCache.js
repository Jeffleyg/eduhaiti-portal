const SQLITE_HOME_CACHE_KEY = "eduhaiti_sqlite_home_cache_v1"
const SQLITE_SYNC_HISTORY_KEY = "eduhaiti_sqlite_sync_history_v1"
const SQLITE_SYNC_CONFLICT_STRATEGY_KEY = "eduhaiti_sync_conflict_strategy_v1"

const SYNC_STRATEGIES = ["lww", "manual"]

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

function normalizeIso(iso) {
  if (!iso || typeof iso !== "string") {
    return 0
  }

  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

function pickByRecency(localRow, remoteRow) {
  const localTs = Math.max(normalizeIso(localRow?.updatedAt), normalizeIso(localRow?.createdAt))
  const remoteTs = Math.max(normalizeIso(remoteRow?.updatedAt), normalizeIso(remoteRow?.createdAt))

  if (remoteTs >= localTs) {
    return remoteRow
  }

  return localRow
}

function mergeEntityArray(localRows, remoteRows, strategy) {
  const local = Array.isArray(localRows) ? localRows : []
  const remote = Array.isArray(remoteRows) ? remoteRows : []
  const localById = new Map(local.filter((item) => item && item.id).map((item) => [item.id, item]))
  const remoteById = new Map(remote.filter((item) => item && item.id).map((item) => [item.id, item]))

  const allIds = new Set([...localById.keys(), ...remoteById.keys()])
  const merged = []
  const conflicts = []

  for (const id of allIds) {
    const localRow = localById.get(id)
    const remoteRow = remoteById.get(id)

    if (!localRow) {
      merged.push(remoteRow)
      continue
    }

    if (!remoteRow) {
      merged.push(localRow)
      continue
    }

    const changed = JSON.stringify(localRow) !== JSON.stringify(remoteRow)
    if (!changed) {
      merged.push(remoteRow)
      continue
    }

    if (strategy === "manual") {
      merged.push({
        ...localRow,
        __syncConflict: {
          id,
          local: localRow,
          remote: remoteRow,
        },
      })
      conflicts.push({ id, local: localRow, remote: remoteRow })
      continue
    }

    merged.push(pickByRecency(localRow, remoteRow))
  }

  return { merged, conflicts }
}

export function readSyncConflictStrategy() {
  const raw = localStorage.getItem(SQLITE_SYNC_CONFLICT_STRATEGY_KEY)
  return SYNC_STRATEGIES.includes(raw) ? raw : "lww"
}

export function writeSyncConflictStrategy(strategy) {
  const value = SYNC_STRATEGIES.includes(strategy) ? strategy : "lww"
  localStorage.setItem(SQLITE_SYNC_CONFLICT_STRATEGY_KEY, value)
  return value
}

export function mergeSyncPayload(localPayload, remotePayload, strategy = "lww") {
  const safeStrategy = SYNC_STRATEGIES.includes(strategy) ? strategy : "lww"
  const local = localPayload && typeof localPayload === "object" ? localPayload : {}
  const remote = remotePayload && typeof remotePayload === "object" ? remotePayload : {}
  const mergedPayload = {}
  const conflicts = []

  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])

  keys.forEach((key) => {
    const localValue = local[key]
    const remoteValue = remote[key]

    if (Array.isArray(localValue) || Array.isArray(remoteValue)) {
      const { merged, conflicts: keyConflicts } = mergeEntityArray(localValue, remoteValue, safeStrategy)
      mergedPayload[key] = merged
      if (keyConflicts.length > 0) {
        conflicts.push({ key, items: keyConflicts })
      }
      return
    }

    if (localValue && remoteValue && typeof localValue === "object" && typeof remoteValue === "object") {
      if (safeStrategy === "manual" && JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
        mergedPayload[key] = {
          ...localValue,
          __syncConflict: {
            local: localValue,
            remote: remoteValue,
          },
        }
        conflicts.push({ key, items: [{ local: localValue, remote: remoteValue }] })
      } else {
        mergedPayload[key] = { ...remoteValue }
      }
      return
    }

    mergedPayload[key] = remoteValue ?? localValue ?? null
  })

  return {
    payload: mergedPayload,
    conflicts,
    strategy: safeStrategy,
  }
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
