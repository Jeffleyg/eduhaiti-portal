function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
      {subtitle ? <p className="text-sm text-brand-navy/60">{subtitle}</p> : null}
    </div>
  )
}

export default SectionHeader
