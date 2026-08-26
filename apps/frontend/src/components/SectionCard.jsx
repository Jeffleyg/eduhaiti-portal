import React from "react"

export default function SectionCard({ children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-brand-navy/10 bg-white/90 p-5 shadow-sm shadow-brand-navy/5 ${className}`}>
      {children}
    </section>
  )
}
