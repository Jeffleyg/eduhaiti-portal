function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-5 rounded-2xl border border-brand-navy/10 bg-white/90 px-5 py-4 shadow-sm shadow-brand-navy/5 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/45">EduHaiti</p>
          <h2 className="font-display text-xl font-semibold text-brand-navy sm:text-2xl">{title}</h2>
        </div>
      </div>
      {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-navy/65">{subtitle}</p> : null}
    </div>
  )
}

export default SectionHeader
