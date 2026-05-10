import React from "react"

export default function SectionCard({ children, className = "" }) {
  return (
    <section className={`rounded-3xl border border-brand-navy/10 bg-white/70 p-6 ${className}`}>
      {children}
    </section>
  )
}
