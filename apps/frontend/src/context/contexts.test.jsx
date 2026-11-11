import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook, screen, waitFor } from "@testing-library/react"
import { Route, Routes } from "react-router-dom"

vi.mock("../lib/api.js", () => ({ apiFetch: vi.fn() }))

import { apiFetch } from "../lib/api.js"
import { AuthProvider, useAuth } from "./AuthContext.jsx"
import { SurvivalModeProvider } from "./SurvivalModeContext.jsx"
import { SyncControlProvider } from "./SyncControlContext.jsx"
import { useSurvivalMode } from "./useSurvivalMode.js"
import { useSyncControl } from "./useSyncControl.js"
import { survivalModeStateManager } from "../lib/survival-mode-state.js"
import ProtectedRoute from "../components/ProtectedRoute.jsx"
import { renderWithRouter } from "../test/utils.jsx"

afterEach(() => {
  apiFetch.mockReset()
})

describe("AuthContext", () => {
  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>

  it("requires the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow("useAuth must be used within AuthProvider")
  })

  it("starts logged out without a token", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it("loads the profile for a stored token", async () => {
    localStorage.setItem("eduhaiti_token", "t")
    apiFetch.mockResolvedValue({ id: "u", role: "ADMIN" })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.user).toEqual({ id: "u", role: "ADMIN" }))
    expect(apiFetch).toHaveBeenCalledWith("/auth/me", { token: "t" })
  })

  it("clears an invalid token", async () => {
    localStorage.setItem("eduhaiti_token", "bad")
    apiFetch.mockRejectedValue(new Error("401"))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.token).toBeNull()
    expect(localStorage.getItem("eduhaiti_token")).toBeNull()
  })

  it("logs in and out, even if the remote logout fails", async () => {
    apiFetch.mockResolvedValue({ id: "u" })
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => result.current.login("tok", { id: "u" }))
    expect(localStorage.getItem("eduhaiti_token")).toBe("tok")
    await waitFor(() => expect(result.current.token).toBe("tok"))

    apiFetch.mockRejectedValueOnce(new Error("down"))
    await act(() => result.current.logout())
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem("eduhaiti_token")).toBeNull()

    apiFetch.mockClear()
    await act(() => result.current.logout())
    expect(apiFetch).not.toHaveBeenCalled()
  })
})

describe("ProtectedRoute", () => {
  const renderRoute = (auth, role, route = "/area") => {
    apiFetch.mockResolvedValue(auth.user)
    if (auth.token) localStorage.setItem("eduhaiti_token", auth.token)
    return renderWithRouter(
      <AuthProvider>
        <Routes>
          <Route element={<ProtectedRoute role={role} />}>
            <Route path="/area" element={<div>secret</div>} />
            <Route path="/change-password" element={<div>change-pw</div>} />
          </Route>
          <Route path="/login" element={<div>login-page</div>} />
        </Routes>
      </AuthProvider>,
      { route },
    )
  }

  it("shows a loader then redirects anonymous users", async () => {
    renderRoute({}, "admin")
    expect(await screen.findByText("login-page")).toBeInTheDocument()
  })

  it("shows the loader while the profile loads", async () => {
    localStorage.setItem("eduhaiti_token", "t")
    let resolve
    apiFetch.mockImplementation(() => new Promise((r) => (resolve = r)))
    renderWithRouter(
      <AuthProvider>
        <Routes>
          <Route element={<ProtectedRoute role="admin" />}>
            <Route path="/area" element={<div>secret</div>} />
          </Route>
        </Routes>
      </AuthProvider>,
      { route: "/area" },
    )
    expect(screen.getByText("loading")).toBeInTheDocument()
    await act(async () => resolve({ role: "ADMIN" }))
    expect(await screen.findByText("secret")).toBeInTheDocument()
  })

  it("forces password changes", async () => {
    renderRoute({ token: "t", user: { role: "ADMIN", mustChangePassword: true } }, "admin")
    expect(await screen.findByText("change-pw")).toBeInTheDocument()
  })

  it("lets users stay on the change-password page", async () => {
    renderRoute({ token: "t", user: { role: "ADMIN", mustChangePassword: true } }, "admin", "/change-password")
    expect(await screen.findByText("change-pw")).toBeInTheDocument()
  })

  it("checks roles", async () => {
    renderRoute({ token: "t", user: { role: "STUDENT" } }, "admin")
    expect(await screen.findByText("login-page")).toBeInTheDocument()
  })

  it("allows matching roles and unknown role guards", async () => {
    renderRoute({ token: "t", user: { role: "TEACHER" } }, "professor")
    expect(await screen.findByText("secret")).toBeInTheDocument()
  })

  it("allows any user when the guard has no role mapping", async () => {
    renderRoute({ token: "t", user: { role: "STUDENT" } }, "unmapped")
    expect(await screen.findByText("secret")).toBeInTheDocument()
  })
})

describe("SurvivalModeContext", () => {
  const originalConnection = navigator.connection
  const setConnection = (value) =>
    Object.defineProperty(navigator, "connection", { configurable: true, value })
  const setBattery = (value) =>
    Object.defineProperty(navigator, "getBattery", { configurable: true, value })
  const wrapper = ({ children }) => <SurvivalModeProvider>{children}</SurvivalModeProvider>

  afterEach(() => {
    setConnection(originalConnection)
    setBattery(undefined)
    survivalModeStateManager.setSurvivalMode(false)
  })

  it("requires the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => renderHook(() => useSurvivalMode())).toThrow("useSurvivalMode must be used within")
  })

  it("defaults to normal mode without browser APIs", () => {
    setConnection(undefined)
    const { result } = renderHook(() => useSurvivalMode(), { wrapper })
    expect(result.current).toMatchObject({ effectiveType: "unknown", isSurvivalMode: false, batteryLevel: 1 })
  })

  it("enters survival mode on 2G and reacts to connection changes", () => {
    const listeners = {}
    const connection = {
      effectiveType: "slow-2g",
      saveData: 1,
      downlink: "0.1",
      addEventListener: (e, fn) => (listeners[e] = fn),
      removeEventListener: vi.fn(),
    }
    setConnection(connection)
    const { result, unmount } = renderHook(() => useSurvivalMode(), { wrapper })
    expect(result.current.is2G).toBe(true)
    expect(survivalModeStateManager.getSurvivalMode()).toBe(true)
    connection.effectiveType = "4g"
    act(() => listeners.change())
    expect(result.current.isSurvivalMode).toBe(false)
    act(() => window.dispatchEvent(new Event("offline")))
    unmount()
    expect(connection.removeEventListener).toHaveBeenCalled()
  })

  it("handles connections without event support or values", () => {
    setConnection({})
    const { result } = renderHook(() => useSurvivalMode(), { wrapper })
    expect(result.current.effectiveType).toBe("unknown")
  })

  it("tracks the battery and cleans up listeners", async () => {
    setConnection(undefined)
    const handlers = {}
    const battery = {
      level: 0.1,
      charging: true,
      addEventListener: (e, fn) => (handlers[e] = fn),
      removeEventListener: vi.fn(),
    }
    setBattery(() => Promise.resolve(battery))
    const { result, unmount } = renderHook(() => useSurvivalMode(), { wrapper })
    await waitFor(() => expect(result.current.isLowBattery).toBe(true))
    expect(result.current.isCharging).toBe(true)
    battery.level = undefined
    battery.charging = false
    act(() => handlers.levelchange())
    expect(result.current.batteryLevel).toBe(1)
    unmount()
    expect(battery.removeEventListener).toHaveBeenCalledTimes(2)
    act(() => handlers.chargingchange())
  })

  it("ignores battery results after unmount and failures", async () => {
    setConnection(undefined)
    let resolveBattery
    setBattery(() => new Promise((r) => (resolveBattery = r)))
    const { unmount } = renderHook(() => useSurvivalMode(), { wrapper })
    unmount()
    await act(async () => resolveBattery({ level: 0.1, addEventListener: vi.fn() }))

    setBattery(() => Promise.reject(new Error("unsupported")))
    const { result } = renderHook(() => useSurvivalMode(), { wrapper })
    await waitFor(() => expect(result.current.batteryLevel).toBe(1))

    let rejectBattery
    setBattery(() => new Promise((_r, rej) => (rejectBattery = rej)))
    const second = renderHook(() => useSurvivalMode(), { wrapper })
    second.unmount()
    await act(async () => rejectBattery(new Error("late")))
  })
})

describe("SyncControlContext", () => {
  const wrapper = ({ children }) => (
    <AuthProvider>
      <SyncControlProvider>{children}</SyncControlProvider>
    </AuthProvider>
  )

  it("requires the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => renderHook(() => useSyncControl())).toThrow("useSyncControl must be used within")
  })

  it("does nothing without a token", async () => {
    const { result } = renderHook(() => useSyncControl(), { wrapper })
    await act(() => result.current.syncNow("student"))
    expect(apiFetch).not.toHaveBeenCalled()
  })

  describe("with a session", () => {
    beforeEach(() => {
      localStorage.setItem("eduhaiti_token", "t")
    })

    const setup = async () => {
      const hook = renderHook(() => useSyncControl(), { wrapper })
      await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/auth/me", { token: "t" }))
      return hook
    }

    it.each([
      ["student", 4],
      ["professor", 2],
      ["admin", 1],
      ["owner", 0],
    ])("syncs the %s tasks", async (role, count) => {
      apiFetch.mockImplementation(async (path) => (path === "/auth/me" ? { id: "u" } : [{ id: 1, path }]))
      const { result } = await setup()
      await act(() => result.current.syncNow(role))
      expect(result.current).toMatchObject({ isSyncing: false, totalTasks: count, completedTasks: count, error: "" })
      expect(result.current.syncRevision).toBe(1)
      expect(result.current.syncHistory[0]).toMatchObject({ role, status: "success", message: "ok:lww" })
    })

    it("uses the current conflict strategy", async () => {
      apiFetch.mockImplementation(async (path) => (path === "/auth/me" ? { id: "u" } : [{ id: 1, v: path }]))
      const { result } = await setup()
      act(() => result.current.setConflictStrategy("manual"))
      expect(result.current.conflictStrategy).toBe("manual")
      await act(() => result.current.syncNow("admin"))
      expect(result.current.syncHistory[0].message).toBe("ok:manual")
    })

    it("records failures", async () => {
      apiFetch.mockImplementation(async (path) => {
        if (path === "/auth/me") return { id: "u" }
        if (path === "/grades/my-grades") throw new Error("grades down")
        return []
      })
      const { result } = await setup()
      await act(() => result.current.syncNow("student"))
      expect(result.current.error).toBe("grades down")
      expect(result.current.syncHistory[0]).toMatchObject({ status: "failed", completedTasks: 1, totalTasks: 4 })

      apiFetch.mockImplementation(async (path) => {
        if (path === "/auth/me") return { id: "u" }
        throw "weird"
      })
      await act(() => result.current.syncNow("admin"))
      expect(result.current.error).toBe("syncFailed")
    })

    it("ignores concurrent sync requests", async () => {
      let release
      apiFetch.mockImplementation(async (path) => {
        if (path === "/auth/me") return { id: "u" }
        await new Promise((r) => (release = r))
        return []
      })
      const { result } = await setup()
      let first
      act(() => {
        first = result.current.syncNow("admin")
      })
      await waitFor(() => expect(result.current.isSyncing).toBe(true))
      await act(() => result.current.syncNow("admin"))
      await act(async () => {
        release()
        await first
      })
      expect(apiFetch.mock.calls.filter((c) => c[0] === "/classes")).toHaveLength(1)
    })
  })
})
