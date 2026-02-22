const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

export async function apiFetch(path, options = {}) {
  const { method = "GET", body, token, headers } = options
  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.message ?? "Request failed")
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}
