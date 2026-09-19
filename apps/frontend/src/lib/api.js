import { shouldBlockRequest, SurvivalModeNetworkError } from "./network-interceptor.js"
import { survivalModeStateManager } from "./survival-mode-state.js"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

export function apiAssetUrl(filePath) {
  if (!filePath) return ""
  const normalized = filePath.startsWith("/") ? filePath.slice(1) : filePath
  return `${API_URL}/${normalized}`
}

function handleAuthError(status) {
  if (status === 401) {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    if (window.location.pathname !== "/login" && window.location.pathname !== "/") {
      window.location.href = "/login?expired=true"
    }
  }
}

export async function apiFetch(path, options = {}) {
  // Verificar bloqueio no modo sobrevivência
  const isSurvivalMode = survivalModeStateManager.getSurvivalMode()
  if (shouldBlockRequest(path, isSurvivalMode)) {
    throw new SurvivalModeNetworkError(path, "non_essential_request_blocked")
  }

  const { method = "GET", body, token, headers } = options
  const authToken = token || localStorage.getItem("token")

  try {
    const response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(headers ?? {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      handleAuthError(response.status)
      const payload = await response.json().catch(() => ({}))
      const fallbackMessage =
        response.status === 403
          ? "Aksè refize / Accès refusé"
          : response.status === 503
          ? "Sèvis la pa disponib kounye a / Service indisponible"
          : "Demann lan echwe / La requête a échoué"

      throw new Error(payload.message ?? fallbackMessage)
    }

    if (response.status === 204) {
      return null
    }

    return response.json()
  } catch (error) {
    if (!navigator.onLine) {
      throw new Error("Ou pa konekte sou entènèt / Vous êtes hors ligne")
    }
    throw error
  }
}

export async function apiFetchRaw(path, options = {}) {
  const isSurvivalMode = survivalModeStateManager.getSurvivalMode()
  if (shouldBlockRequest(path, isSurvivalMode)) {
    throw new SurvivalModeNetworkError(path, "non_essential_request_blocked")
  }

  const { method = "GET", body, token, headers } = options
  const authToken = token || localStorage.getItem("token")

  try {
    const response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(headers ?? {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      handleAuthError(response.status)
      const contentType = response.headers.get("content-type") ?? ""
      const payload = contentType.includes("application/json")
        ? await response.json().catch(() => ({}))
        : await response.text().catch(() => "")

      const fallbackMessage = typeof payload === "string" ? payload : payload.message
      throw new Error(fallbackMessage || "Request failed")
    }

    return response
  } catch (error) {
    if (!navigator.onLine) {
      throw new Error("Ou pa konekte sou entènèt / Vous êtes hors ligne")
    }
    throw error
  }
}

export async function apiUpload(path, options = {}) {
  const isSurvivalMode = survivalModeStateManager.getSurvivalMode()
  if (shouldBlockRequest(path, isSurvivalMode)) {
    throw new SurvivalModeNetworkError(path, "non_essential_request_blocked")
  }

  const { method = "POST", token, formData, headers } = options
  const authToken = token || localStorage.getItem("token")

  try {
    const response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(headers ?? {}),
      },
      body: formData,
    })

    if (!response.ok) {
      handleAuthError(response.status)
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.message ?? "Upload failed")
    }

    if (response.status === 204) {
      return null
    }

    return response.json()
  } catch (error) {
    if (!navigator.onLine) {
      throw new Error("Ou pa konekte sou entènèt / Vous êtes hors ligne")
    }
    throw error
  }
}