import {
  readOfflineAssetManifest,
  upsertOfflineAsset,
  removeOfflineAsset,
} from "./sqliteCache"

const CACHE_NAME = "eduhaiti-offline-assets-v1"

export function listOfflineAssets() {
  return readOfflineAssetManifest()
}

export function isOfflineAsset(resourceId) {
  const manifest = readOfflineAssetManifest()
  return manifest.some((item) => item.resourceId === resourceId)
}

export async function saveAssetOffline(resource) {
  if (!resource?.id || !resource?.url) {
    throw new Error("Invalid resource for offline save")
  }

  if (typeof window !== "undefined" && "caches" in window) {
    const cache = await caches.open(CACHE_NAME)
    const response = await fetch(resource.url, { credentials: "include" })
    if (!response.ok) {
      throw new Error("Unable to fetch asset for offline save")
    }

    await cache.put(resource.url, response.clone())
  }

  return upsertOfflineAsset({
    resourceId: resource.id,
    title: resource.title ?? "Recurso",
    fileType: resource.fileType ?? "file",
    url: resource.url,
    cachedAt: new Date().toISOString(),
  })
}

export async function removeOffline(resourceId, url) {
  if (!resourceId) {
    return readOfflineAssetManifest()
  }

  if (url && typeof window !== "undefined" && "caches" in window) {
    const cache = await caches.open(CACHE_NAME)
    await cache.delete(url)
  }

  return removeOfflineAsset(resourceId)
}
