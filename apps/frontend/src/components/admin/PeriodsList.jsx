import React from "react"
import PeriodItem from "./PeriodItem.jsx"

export default function PeriodsList({ t, periods, togglePeriod, removePeriod }) {
  if (!periods || periods.length === 0) {
    return <p className="text-sm text-brand-navy/60">{t("noData")}</p>
  }

  return (
    <div className="mt-4 space-y-3">
      {periods.map((p) => (
        <PeriodItem key={p.id} period={p} togglePeriod={togglePeriod} removePeriod={removePeriod} t={t} />
      ))}
    </div>
  )
}
