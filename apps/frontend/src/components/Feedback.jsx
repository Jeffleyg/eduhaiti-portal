import React from "react"

export default function Feedback({ error, message }) {
  if (!error && !message) return null
  return (
    <div className="space-y-1">
      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
    </div>
  )
}
