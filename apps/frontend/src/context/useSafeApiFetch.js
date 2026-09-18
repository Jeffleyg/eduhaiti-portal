import { useCallback, useState } from "react"
import { apiFetch } from "../lib/api.js"
import { SurvivalModeNetworkError } from "../lib/network-interceptor.js"
import { useSurvivalMode } from "./useSurvivalMode.js"

/**
 * Hook for safely fetching data with survival mode awareness
 * Returns: { data, error, loading, isBlocked, isNonEssential }
 * 
 * Usage:
 *   const { data, isBlocked } = useSafeApiFetch(() => apiFetch('/analytics'), [])
 *   
 *   if (isBlocked) {
 *     return <div>Feature unavailable in survival mode</div>
 *   }
 */
export function useSafeApiFetch(fetchFn, defaultValue = null) {
  const [data, setData] = useState(defaultValue)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const survivalMode = useSurvivalMode()

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)
    setIsBlocked(false)

    try {
      const result = await fetchFn()
      setData(result)
    } catch (err) {
      if (err instanceof SurvivalModeNetworkError) {
        setIsBlocked(true)
        setError(null) // Don't show error for blocked requests
      } else {
        setError(err)
        setIsBlocked(false)
      }
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  return {
    data,
    error,
    loading,
    isBlocked,
    isSurvivalMode: survivalMode.isSurvivalMode,
    execute,
  }
}
