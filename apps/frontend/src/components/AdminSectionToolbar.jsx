import React from "react"

export default function AdminSectionToolbar({ sections = [], active, onChange }) {
  return (
    <div className="flex gap-2">
      {sections.map((s) => (
        <button
          key={s.key}
          onClick={() => onChange(s.key)}
          className={`rounded-2xl px-3 py-2 text-sm ${active === s.key ? "primary-button" : "outline-button"}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
