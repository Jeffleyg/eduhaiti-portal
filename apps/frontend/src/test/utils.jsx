import { render } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { vi } from "vitest"

/**
 * Renders a UI inside a MemoryRouter. Pass `path` to mount it under a route
 * pattern (e.g. "/classes/:id") and `route` for the initial URL.
 */
export function renderWithRouter(ui, { route = "/", path } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {path ? (
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<div data-testid="redirected" />} />
        </Routes>
      ) : (
        ui
      )}
    </MemoryRouter>,
  )
}

/**
 * Builds an apiFetch mock that answers by path. Handlers can be values,
 * functions `(options, path) => value`, or Errors (rejected).
 * Unmatched paths resolve to `fallback` (default []).
 */
export function routeApi(routes = {}, fallback = []) {
  return vi.fn(async (path, options = {}) => {
    const method = (options.method ?? "GET").toUpperCase()
    const keys = [`${method} ${path}`, path, `${method} ${path.split("?")[0]}`, path.split("?")[0]]
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(routes, key)) {
        const handler = routes[key]
        const value = typeof handler === "function" ? await handler(options, path) : handler
        if (value instanceof Error) throw value
        return value
      }
    }
    for (const [key, handler] of Object.entries(routes)) {
      if (key.endsWith("*") && path.startsWith(key.slice(0, -1).replace(/^(GET|POST|PUT|PATCH|DELETE) /, ""))) {
        const value = typeof handler === "function" ? await handler(options, path) : handler
        if (value instanceof Error) throw value
        return value
      }
    }
    return fallback
  })
}

/** Response-like object for fetch mocks. */
export function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? (body !== undefined ? "application/json" : null) },
    json: async () => {
      if (body instanceof Error) throw body
      return body
    },
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    blob: async () => new Blob([JSON.stringify(body)]),
  }
}
