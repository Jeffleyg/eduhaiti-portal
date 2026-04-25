function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-5 rounded-2xl border border-brand-navy/10 bg-white/70 px-4 py-3 sm:px-5">
      <h2 className="text-lg font-semibold text-brand-navy sm:text-xl">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-brand-navy/60">{subtitle}</p> : null}
    </div>
  )
}

export default SectionHeader
