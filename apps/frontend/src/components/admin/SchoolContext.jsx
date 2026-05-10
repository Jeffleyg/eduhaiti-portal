import React from "react"
import Button from "../Button.jsx"
import Input from "../Input.jsx"

export default function SchoolContext({ t, schoolId, setSchoolId, loadPeriods, loadSettings, loading }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-brand-navy">{t("academicSchoolContext")}</h3>
      <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end">
        <label className="flex-1 text-sm text-brand-navy/70">
          {t("academicSchoolId")}
          <Input value={schoolId} onChange={(e) => setSchoolId(e.target.value)} placeholder="school-uuid" />
        </label>
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
