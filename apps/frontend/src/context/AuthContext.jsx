import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { apiFetch } from "../lib/api.js"

const AuthContext = createContext(null)

const TOKEN_KEY = "eduhaiti_token"

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(token))

  const refreshProfile = useCallback(async () => {
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const profile = await apiFetch("/auth/me", { token })
      setUser(profile)
    } catch (error) {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])

  const login = (nextToken, nextUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken)
    setToken(nextToken)
    setUser(nextUser)
  }

  const logout = async () => {
    if (token) {
      try {
        await apiFetch("/auth/logout", { method: "POST", token })
      } catch {
        // Always clear local session even if remote logout audit fails.
      }
    }

    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  const value = useMemo(
    () => ({ token, user, loading, login, logout, refreshProfile }),
    [token, user, loading, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
