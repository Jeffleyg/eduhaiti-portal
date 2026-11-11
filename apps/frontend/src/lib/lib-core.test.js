import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { jsonResponse } from "../test/utils.jsx"
import { apiAssetUrl, apiFetch, apiFetchRaw, apiUpload } from "./api.js"
import { classifyRequest, shouldBlockRequest, SurvivalModeNetworkError } from "./network-interceptor.js"
import { survivalModeStateManager } from "./survival-mode-state.js"

const BASE = "http://localhost:3000"

describe("network-interceptor", () => {
  it("classifies requests", () => {
    expect(classifyRequest("/api/auth/login")).toBe("ESSENTIAL")
    expect(classifyRequest("/classes?x=1")).toBe("ESSENTIAL")
    expect(classifyRequest("/announcements")).toBe("ADVISORY")
    expect(classifyRequest("/analytics/x")).toBe("NON_ESSENTIAL")
    expect(classifyRequest("/unknown")).toBe("ADVISORY")
  })

  it("blocks only non-essential requests in survival mode", () => {
    expect(shouldBlockRequest("/analytics", false)).toBe(false)
    expect(shouldBlockRequest("/analytics", true)).toBe(true)
    expect(shouldBlockRequest("/auth/me", true)).toBe(false)
  })

  it("builds a descriptive error", () => {
    const e = new SurvivalModeNetworkError("/x")
    expect(e).toMatchObject({ code: "SURVIVAL_MODE_BLOCKED", path: "/x", reason: "blocked_in_survival_mode" })
    expect(new SurvivalModeNetworkError("/y", "r").message).toContain("(r)")
  })
})

describe("survivalModeStateManager", () => {
  afterEach(() => survivalModeStateManager.setSurvivalMode(false))

  it("notifies subscribers only on change and supports unsubscribe", () => {
    const listener = vi.fn()
    const unsubscribe = survivalModeStateManager.subscribe(listener)
    survivalModeStateManager.setSurvivalMode(true)
    survivalModeStateManager.setSurvivalMode(true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(survivalModeStateManager.getSurvivalMode()).toBe(true)
    unsubscribe()
    survivalModeStateManager.setSurvivalMode(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe("api", () => {
  let fetchMock
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    survivalModeStateManager.setSurvivalMode(false)
  })

  it("builds asset URLs", () => {
    expect(apiAssetUrl("")).toBe("")
    expect(apiAssetUrl("/uploads/a.pdf")).toBe(`${BASE}/uploads/a.pdf`)
    expect(apiAssetUrl("uploads/b.pdf")).toBe(`${BASE}/uploads/b.pdf`)
  })

  describe("apiFetch", () => {
    it("sends JSON with explicit, stored or no token", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: 1 }))
      await expect(apiFetch("/x", { method: "POST", body: { a: 1 }, token: "t", headers: { X: "1" } })).resolves.toEqual({ ok: 1 })
      expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/x`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer t", X: "1" },
        body: '{"a":1}',
      })
      localStorage.setItem("eduhaiti_token", "stored")
      await apiFetch("/y")
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer stored")
      localStorage.clear()
      localStorage.setItem("token", "legacy")
      await apiFetch("/y")
      expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer legacy")
      localStorage.clear()
      await apiFetch("/y")
      expect(fetchMock.mock.calls[3][1].headers.Authorization).toBeUndefined()
      expect(fetchMock.mock.calls[3][1].body).toBeUndefined()
    })

    it("returns null for 204", async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 204 })
      await expect(apiFetch("/x")).resolves.toBeNull()
    })

    it("uses server or fallback messages for errors", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: "nope" }, { status: 400 }))
      await expect(apiFetch("/x")).rejects.toThrow("nope")
      fetchMock.mockResolvedValueOnce(jsonResponse(new Error("bad json"), { status: 403 }))
      await expect(apiFetch("/x")).rejects.toThrow("Accès refusé")
      fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 503 }))
      await expect(apiFetch("/x")).rejects.toThrow("Service indisponible")
      fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 500 }))
      await expect(apiFetch("/x")).rejects.toThrow("La requête a échoué")
    })

    it("clears the session and redirects on 401 outside login", async () => {
      const original = window.location
      delete window.location
      window.location = { pathname: "/student", href: "" }
      localStorage.setItem("eduhaiti_token", "t")
      localStorage.setItem("token", "t")
      localStorage.setItem("user", "u")
      fetchMock.mockResolvedValue(jsonResponse({}, { status: 401 }))
      await expect(apiFetch("/x")).rejects.toThrow()
      expect(localStorage.getItem("eduhaiti_token")).toBeNull()
      expect(window.location.href).toBe("/login?expired=true")

      window.location = { pathname: "/login", href: "" }
      await expect(apiFetch("/x")).rejects.toThrow()
      expect(window.location.href).toBe("")
      window.location = { pathname: "/", href: "" }
      await expect(apiFetch("/x")).rejects.toThrow()
      expect(window.location.href).toBe("")
      window.location = original
    })

    it("reports offline errors", async () => {
      fetchMock.mockRejectedValue(new Error("network"))
      await expect(apiFetch("/x")).rejects.toThrow("network")
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false })
      await expect(apiFetch("/x")).rejects.toThrow("Vous êtes hors ligne")
    })

    it("blocks non-essential calls in survival mode", async () => {
      survivalModeStateManager.setSurvivalMode(true)
      await expect(apiFetch("/analytics")).rejects.toBeInstanceOf(SurvivalModeNetworkError)
      await expect(apiFetchRaw("/analytics")).rejects.toBeInstanceOf(SurvivalModeNetworkError)
      await expect(apiUpload("/analytics")).rejects.toBeInstanceOf(SurvivalModeNetworkError)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe("apiFetchRaw", () => {
    it("returns the raw response", async () => {
      const res = jsonResponse({ a: 1 })
      fetchMock.mockResolvedValue(res)
      await expect(apiFetchRaw("/f", { method: "POST", body: { x: 1 }, token: "t", headers: { H: "1" } })).resolves.toBe(res)
      expect(fetchMock.mock.calls[0][1]).toEqual({
        method: "POST",
        headers: { Authorization: "Bearer t", H: "1" },
        body: '{"x":1}',
      })
      await apiFetchRaw("/f")
      expect(fetchMock.mock.calls[1][1]).toEqual({ method: "GET", headers: {}, body: undefined })
    })

    it("extracts JSON or text error messages", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: "json err" }, { status: 400, headers: { "content-type": "application/json" } }))
      await expect(apiFetchRaw("/f")).rejects.toThrow("json err")
      fetchMock.mockResolvedValueOnce(jsonResponse(new Error("x"), { status: 400, headers: { "content-type": "application/json" } }))
      await expect(apiFetchRaw("/f")).rejects.toThrow("Request failed")
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500, headers: { get: () => "text/plain" }, text: async () => "plain err" })
      await expect(apiFetchRaw("/f")).rejects.toThrow("plain err")
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500, headers: { get: () => null }, text: async () => { throw new Error() } })
      await expect(apiFetchRaw("/f")).rejects.toThrow("Request failed")
    })

    it("reports offline errors", async () => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false })
      fetchMock.mockRejectedValue(new Error("network"))
      await expect(apiFetchRaw("/f")).rejects.toThrow("hors ligne")
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
      await expect(apiFetchRaw("/f")).rejects.toThrow("network")
    })
  })

  describe("apiUpload", () => {
    it("posts form data", async () => {
      const form = new FormData()
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1 }))
      await expect(apiUpload("/u", { formData: form, token: "t", headers: { H: "1" } })).resolves.toEqual({ id: 1 })
      expect(fetchMock.mock.calls[0][1]).toEqual({ method: "POST", headers: { Authorization: "Bearer t", H: "1" }, body: form })
      fetchMock.mockResolvedValueOnce({ ok: true, status: 204 })
      await expect(apiUpload("/u", { method: "PUT" })).resolves.toBeNull()
      expect(fetchMock.mock.calls[1][1].headers).toEqual({})
    })

    it("handles errors", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: "too big" }, { status: 413 }))
      await expect(apiUpload("/u")).rejects.toThrow("too big")
      fetchMock.mockResolvedValueOnce(jsonResponse(new Error("x"), { status: 500 }))
      await expect(apiUpload("/u")).rejects.toThrow("Upload failed")
      fetchMock.mockRejectedValueOnce(new Error("net"))
      await expect(apiUpload("/u")).rejects.toThrow("net")
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false })
      fetchMock.mockRejectedValueOnce(new Error("net"))
      await expect(apiUpload("/u")).rejects.toThrow("hors ligne")
    })
  })
})
