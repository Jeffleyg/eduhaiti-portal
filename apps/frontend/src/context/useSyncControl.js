import { useContext } from "react"
import { SyncControlContext } from "./SyncControlStore.js"

export function useSyncControl() {
  const context = useContext(SyncControlContext)
  if (!context) {
    throw new Error("useSyncControl must be used within SyncControlProvider")
  }
  return context
}
