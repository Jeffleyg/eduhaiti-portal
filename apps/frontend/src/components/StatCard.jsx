function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-brand-navy/10 bg-white/90 px-4 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/60">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-brand-navy">{value}</p>
    </div>
  )
}

export default StatCard
