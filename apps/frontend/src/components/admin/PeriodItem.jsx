import React from "react"
import Button from "../Button.jsx"

export default function PeriodItem({ period, togglePeriod, removePeriod, t }) {
  return (
    <div className="rounded-2xl border border-brand-navy/10 bg-white p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-brand-navy">{period.name}</p>
          <p className="text-xs text-brand-navy/60">{period.startDate?.slice(0, 10)} - {period.endDate?.slice(0, 10)}</p>
          <p className="text-xs text-brand-navy/60">{period.description || "-"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${period.isOpen ? "bg-emerald-100 text-emerald-700" : "bg-brand-red/10 text-brand-red"}`}>
            {period.isOpen ? t("academicStatusOpen") : t("academicStatusClosed")}
          </span>
          <Button variant="outline" type="button" onClick={() => togglePeriod(period)}>
            {period.isOpen ? t("academicClose") : t("academicOpen")}
          </Button>
          <Button variant="outline" type="button" onClick={() => removePeriod(period.id)}>
            {t("academicDelete")}
          </Button>
        </div>
      </div>
    </div>
  )
}
