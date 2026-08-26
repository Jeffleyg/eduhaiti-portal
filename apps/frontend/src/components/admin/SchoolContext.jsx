import React from "react"
import Button from "../Button.jsx"
import Input from "../Input.jsx"

export default function SchoolContext({ t, schoolId, setSchoolId, loadPeriods, loadSettings, loading, locked = false }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-brand-navy">{t("academicSchoolContext")}</h3>
      <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end">
        {locked ? (
          <div className="flex-1 rounded-2xl border border-brand-navy/10 bg-brand-navy/5 px-3 py-2 text-sm text-brand-navy/70">
            <span className="block text-xs font-semibold uppercase tracking-wide text-brand-navy/50">
              {t("academicSchoolId")}
            </span>
            <span className="mt-1 block break-all font-medium text-brand-navy">{schoolId || "-"}</span>
          </div>
        ) : (
          <label className="flex-1 text-sm text-brand-navy/70">
            {t("academicSchoolId")}
            <Input
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              placeholder={t("academicSchoolIdPlaceholder")}
            />
          </label>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadPeriods} disabled={loading}>
            {t("academicLoadPeriods")}
          </Button>
          <Button variant="outline" onClick={loadSettings} disabled={loading}>
            {t("academicLoadSettings")}
          </Button>
        </div>
      </div>
    </div>
  )
}
