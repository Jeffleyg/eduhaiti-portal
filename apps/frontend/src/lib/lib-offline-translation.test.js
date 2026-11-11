import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { jsonResponse } from "../test/utils.jsx"
import {
  FEATURED_LANGUAGES,
  getLanguageCode,
  getSupportedLanguages,
  LANGUAGE_MAP,
  translateObject,
  translateText,
  translationCache,
} from "./translationService.js"
import {
  appendSyncHistory,
  formatLastUpdated,
  mergeSyncPayload,
  readHomeCache,
  readOfflineAssetManifest,
  readSyncConflictStrategy,
  readSyncHistory,
  removeOfflineAsset,
  upsertOfflineAsset,
  writeHomeCache,
  writeSyncConflictStrategy,
} from "../offline/sqliteCache.js"
import { isOfflineAsset, listOfflineAssets, removeOffline, saveAssetOffline } from "../offline/offlineAssetLibrary.js"

describe("translationService", () => {
  let fetchMock
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "warn").mockImplementation(() => {})
  })
  afterEach(() => vi.unstubAllGlobals())

  it("short-circuits empty or same-language text", async () => {
    expect(await translateText("")).toBe("")
    expect(await translateText("   ")).toBe("   ")
    expect(await translateText("x", "fr", "fr")).toBe("x")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("translates via the API and falls back to the original text", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ translatedText: "Olá" }))
    expect(await translateText("Bonjour")).toBe("Olá")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ q: "Bonjour", source: "fr", target: "pt" })

    fetchMock.mockResolvedValueOnce(jsonResponse({}))
    expect(await translateText("Salut", "es", "auto")).toBe("Salut")
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).source).toBe("auto")

    fetchMock.mockResolvedValueOnce({ ok: false, status: 429 })
    expect(await translateText("Merci")).toBe("Merci")
    fetchMock.mockRejectedValueOnce(new Error("offline"))
    expect(await translateText("Merci")).toBe("Merci")
  })

  it("translates nested objects keeping non-strings", async () => {
    fetchMock.mockImplementation(async (_u, init) => jsonResponse({ translatedText: `T:${JSON.parse(init.body).q}` }))
    expect(await translateObject({ a: "x", b: { c: "y" }, d: 3, e: null }, "pt", "fr")).toEqual({
      a: "T:x",
      b: { c: "T:y" },
      d: 3,
      e: null,
    })
  })

  it("caches translations with expiry", () => {
    expect(translationCache.get("k")).toBeNull()
    expect(translationCache.isExpired("k")).toBe(true)
    translationCache.set("k", { a: 1 })
    expect(translationCache.get("k").value).toEqual({ a: 1 })
    expect(translationCache.isExpired("k")).toBe(false)
    translationCache.set("old", 1, -1)
    expect(translationCache.isExpired("old")).toBe(true)
    localStorage.setItem("translation_cache_bad", "{")
    expect(translationCache.get("bad")).toBeNull()
    expect(translationCache.isExpired("bad")).toBe(true)
    localStorage.setItem("other", "1")
    translationCache.clear()
    expect(localStorage.getItem("translation_cache_k")).toBeNull()
    expect(localStorage.getItem("other")).toBe("1")
  })

  it("survives storage failures", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota")
    })
    translationCache.set("k", 1)
    vi.spyOn(Object, "keys").mockImplementationOnce(() => {
      throw new Error("denied")
    })
    translationCache.clear()
    expect(console.warn).toHaveBeenCalledTimes(2)
  })

  it("lists languages and resolves codes", () => {
    const langs = getSupportedLanguages()
    expect(langs.slice(0, FEATURED_LANGUAGES.length).map((l) => l.code)).toEqual(FEATURED_LANGUAGES)
    expect(langs).toHaveLength(Object.keys(LANGUAGE_MAP).length)
    expect(getLanguageCode("french")).toBe("fr")
    expect(getLanguageCode("Kreyòl Ayisyen")).toBe("ht")
    expect(getLanguageCode("Klingon")).toBeNull()
  })
})

describe("sqliteCache", () => {
  it("reads and writes the sync conflict strategy", () => {
    expect(readSyncConflictStrategy()).toBe("lww")
    expect(writeSyncConflictStrategy("manual")).toBe("manual")
    expect(readSyncConflictStrategy()).toBe("manual")
    expect(writeSyncConflictStrategy("weird")).toBe("lww")
  })

  it("stores the home cache per role", () => {
    expect(readHomeCache("student")).toEqual({ data: null, lastUpdatedAt: null })
    const ts = writeHomeCache("student", { a: 1 })
    expect(readHomeCache("student")).toEqual({ data: { a: 1 }, lastUpdatedAt: ts })
    localStorage.setItem("eduhaiti_sqlite_home_cache_v1", JSON.stringify({ teacher: {} }))
    expect(readHomeCache("teacher")).toEqual({ data: null, lastUpdatedAt: null })
    localStorage.setItem("eduhaiti_sqlite_home_cache_v1", "null")
    expect(readHomeCache("teacher").data).toBeNull()
    localStorage.setItem("eduhaiti_sqlite_home_cache_v1", "{bad")
    expect(readHomeCache("teacher").data).toBeNull()
  })

  it("keeps the latest 30 sync history entries", () => {
    expect(readSyncHistory()).toEqual([])
    for (let i = 0; i < 35; i += 1) appendSyncHistory({ i })
    expect(readSyncHistory(100)).toHaveLength(30)
    expect(readSyncHistory()[0]).toEqual({ i: 34 })
    expect(readSyncHistory(0)).toHaveLength(1)
    localStorage.setItem("eduhaiti_sqlite_sync_history_v1", "{}")
    expect(readSyncHistory()).toEqual([])
    localStorage.setItem("eduhaiti_sqlite_sync_history_v1", "{bad")
    expect(readSyncHistory()).toEqual([])
  })

  it("formats last-updated timestamps", () => {
    expect(formatLastUpdated(null)).toBe("-")
    expect(formatLastUpdated("bad")).toBe("-")
    expect(formatLastUpdated("2026-01-02T03:04:00Z", "ht")).toMatch(/2026/)
    expect(formatLastUpdated("2026-01-02T03:04:00Z", "fr")).toMatch(/2026/)
  })

  it("manages the offline asset manifest", () => {
    expect(readOfflineAssetManifest()).toEqual([])
    upsertOfflineAsset({ resourceId: "a", v: 1 })
    upsertOfflineAsset({ resourceId: "b" })
    upsertOfflineAsset({ resourceId: "a", v: 2 })
    expect(readOfflineAssetManifest().map((x) => x.resourceId)).toEqual(["a", "b"])
    expect(readOfflineAssetManifest()[0].v).toBe(2)
    expect(removeOfflineAsset("a").map((x) => x.resourceId)).toEqual(["b"])
    localStorage.setItem("eduhaiti_offline_asset_manifest_v1", "{}")
    expect(readOfflineAssetManifest()).toEqual([])
    localStorage.setItem("eduhaiti_offline_asset_manifest_v1", "{bad")
    expect(readOfflineAssetManifest()).toEqual([])
  })

  describe("mergeSyncPayload", () => {
    const local = {
      classes: [
        { id: 1, name: "A", updatedAt: "2026-01-02" },
        { id: 2, name: "local-only" },
        { id: 3, name: "same" },
        { id: 4, name: "local-newer", updatedAt: "2026-03-01" },
        null,
      ],
      profile: { name: "L" },
      flag: "local",
      onlyLocal: 1,
    }
    const remote = {
      classes: [
        { id: 1, name: "B", updatedAt: "2026-01-03" },
        { id: 3, name: "same" },
        { id: 4, name: "remote-older", createdAt: "2026-01-01" },
        { id: 5, name: "remote-only" },
      ],
      profile: { name: "R" },
      flag: "remote",
      onlyRemote: 2,
    }

    it("uses last-write-wins by default (and for unknown strategies)", () => {
      const r = mergeSyncPayload(local, remote, "nope")
      expect(r.strategy).toBe("lww")
      expect(r.conflicts).toEqual([])
      const byId = Object.fromEntries(r.payload.classes.map((c) => [c.id, c.name]))
      expect(byId).toEqual({ 1: "B", 2: "local-only", 3: "same", 4: "local-newer", 5: "remote-only" })
      expect(r.payload.profile).toEqual({ name: "R" })
      expect(r.payload.flag).toBe("remote")
      expect(r.payload.onlyLocal).toBe(1)
      expect(r.payload.onlyRemote).toBe(2)
    })

    it("flags conflicts in manual mode", () => {
      const r = mergeSyncPayload(local, remote, "manual")
      expect(r.conflicts.map((c) => c.key)).toEqual(["classes", "profile"])
      expect(r.payload.classes.find((c) => c.id === 1).__syncConflict).toBeDefined()
      expect(r.payload.profile.__syncConflict).toEqual({ local: { name: "L" }, remote: { name: "R" } })
      const same = mergeSyncPayload({ p: { a: 1 } }, { p: { a: 1 } }, "manual")
      expect(same.conflicts).toEqual([])
    })

    it("handles missing payloads and mixed shapes", () => {
      expect(mergeSyncPayload(null, undefined)).toEqual({ payload: {}, conflicts: [], strategy: "lww" })
      expect(mergeSyncPayload({ a: [{ id: 1 }] }, { a: "not-array", b: null }).payload).toEqual({
        a: [{ id: 1 }],
        b: null,
      })
    })
  })
})

describe("offlineAssetLibrary", () => {
  let cache
  let fetchMock
  beforeEach(() => {
    cache = { put: vi.fn(), delete: vi.fn() }
    vi.stubGlobal("caches", { open: vi.fn(async () => cache) })
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("validates resources", async () => {
    await expect(saveAssetOffline({})).rejects.toThrow("Invalid resource")
    await expect(saveAssetOffline(null)).rejects.toThrow("Invalid resource")
  })

  it("caches and records assets", async () => {
    fetchMock.mockResolvedValue({ ok: true, clone: () => "clone" })
    const list = await saveAssetOffline({ id: "r1", url: "http://x/a.pdf", title: "A", fileType: "pdf" })
    expect(cache.put).toHaveBeenCalledWith("http://x/a.pdf", "clone")
    expect(list[0]).toMatchObject({ resourceId: "r1", title: "A", fileType: "pdf" })
    await saveAssetOffline({ id: "r2", url: "http://x/b" })
    expect(listOfflineAssets()[0]).toMatchObject({ resourceId: "r2", title: "Recurso", fileType: "file" })
    expect(isOfflineAsset("r1")).toBe(true)
    expect(isOfflineAsset("zz")).toBe(false)
  })

  it("fails when the asset cannot be fetched", async () => {
    fetchMock.mockResolvedValue({ ok: false })
    await expect(saveAssetOffline({ id: "r1", url: "u" })).rejects.toThrow("Unable to fetch")
  })

  it("works without the Cache API", async () => {
    vi.unstubAllGlobals()
    const original = window.caches
    delete window.caches
    await saveAssetOffline({ id: "r1", url: "u" })
    expect(listOfflineAssets()).toHaveLength(1)
    expect(await removeOffline("r1", "u")).toEqual([])
    if (original) window.caches = original
  })

  it("removes assets", async () => {
    upsertOfflineAsset({ resourceId: "r1" })
    expect(await removeOffline("", "u")).toHaveLength(1)
    expect(await removeOffline("r1")).toEqual([])
    upsertOfflineAsset({ resourceId: "r2" })
    expect(await removeOffline("r2", "u")).toEqual([])
    expect(cache.delete).toHaveBeenCalledWith("u")
  })
})
