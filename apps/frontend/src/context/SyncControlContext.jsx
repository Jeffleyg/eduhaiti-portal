import { useCallback, useMemo, useState } from "react"
import { apiFetch } from "../lib/api.js"
import { useAuth } from "./AuthContext.jsx"
import {
  appendSyncHistory,
  mergeSyncPayload,
  readHomeCache,
  readSyncConflictStrategy,
  readSyncHistory,
  writeHomeCache,
  writeSyncConflictStrategy,
} from "../offline/sqliteCache"
import { SyncControlContext } from "./SyncControlStore.js"

function getRoleTasks(role) {
  if (role === "professor") {
    return [
      { label: "classes", path: "/classes/my-classes" },
      { label: "messages", path: "/messages/inbox" },
    ]
  }

  if (role === "student") {
    return [
      { label: "classes", path: "/classes/my-classes" },
      { label: "grades", path: "/grades/my-grades" },
      { label: "attendance", path: "/attendance/my-attendance" },
      { label: "messages", path: "/messages/inbox" },
    ]
  }

  if (role === "admin") {
    return [{ label: "classes", path: "/classes" }]
  }

  return []
}

export function SyncControlProvider({ children }) {
  const { token } = useAuth()
  const [isSyncing, setIsSyncing] = useState(false)
  const [completedTasks, setCompletedTasks] = useState(0)
  const [totalTasks, setTotalTasks] = useState(0)
  const [currentTask, setCurrentTask] = useState("")
  const [lastRunAt, setLastRunAt] = useState(null)
  const [error, setError] = useState("")
  const [syncRevision, setSyncRevision] = useState(0)
  const [syncHistory, setSyncHistory] = useState(() => readSyncHistory(10))
  const [conflictStrategy, setConflictStrategyState] = useState(() => readSyncConflictStrategy())
  const [lastSyncConflicts, setLastSyncConflicts] = useState([])

  const setConflictStrategy = useCallback((strategy) => {
    const next = writeSyncConflictStrategy(strategy)
    setConflictStrategyState(next)
  }, [])

  const syncNow = useCallback(
    async (role) => {
      if (!token || isSyncing) {
        return
      }

      const tasks = getRoleTasks(role)
      setIsSyncing(true)
      setCompletedTasks(0)
      setTotalTasks(tasks.length)
      setCurrentTask("")
      setError("")
      let completedCount = 0

      try {
        const payload = {}

        for (let i = 0; i < tasks.length; i += 1) {
          const task = tasks[i]
          setCurrentTask(task.label)

          const result = await apiFetch(task.path, { token })
          payload[task.label] = result

          completedCount = i + 1
          setCompletedTasks(completedCount)
        }

        if (tasks.length > 0) {
          const currentCache = readHomeCache(role).data
          const merged = mergeSyncPayload(currentCache, payload, conflictStrategy)
          writeHomeCache(role, merged.payload)
          setLastSyncConflicts(merged.conflicts)
        }

        setLastRunAt(new Date().toISOString())
        setSyncRevision((value) => value + 1)

        const successEntry = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          role,
          status: "success",
          completedTasks: tasks.length,
          totalTasks: tasks.length,
          message: `ok:${conflictStrategy}`,
        }
        appendSyncHistory(successEntry)
        setSyncHistory(readSyncHistory(10))
      } catch (syncError) {
        const message = syncError instanceof Error ? syncError.message : "Sync failed"
        setError(message)

        const failEntry = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          role,
          status: "failed",
          completedTasks: completedCount,
          totalTasks: tasks.length,
          message,
        }
        appendSyncHistory(failEntry)
        setSyncHistory(readSyncHistory(10))
      } finally {
        setCurrentTask("")
        setIsSyncing(false)
      }
    },
    [token, isSyncing],
  )

  const value = useMemo(
    () => ({
      isSyncing,
      completedTasks,
      totalTasks,
      currentTask,
      lastRunAt,
      error,
      syncRevision,
      syncHistory,
      conflictStrategy,
      lastSyncConflicts,
      setConflictStrategy,
      syncNow,
    }),
    [
      isSyncing,
      completedTasks,
      totalTasks,
      currentTask,
      lastRunAt,
      error,
      syncRevision,
      syncHistory,
      conflictStrategy,
      lastSyncConflicts,
      setConflictStrategy,
      syncNow,
    ],
  )

  return <SyncControlContext.Provider value={value}>{children}</SyncControlContext.Provider>
}
