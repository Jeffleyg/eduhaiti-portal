import React from "react"
import Button from "../Button.jsx"
import Input from "../Input.jsx"

export default function SettingsForm({ t, settingsForm, setSettingsForm, saveSettings, loading }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-brand-navy">{t("academicSettingsTitle")}</h3>
      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={saveSettings}>
        <label className="text-sm text-brand-navy/70">
          {t("academicPassAverage")}
          <Input type="number" min="0" max="20" step="0.1" value={settingsForm.passAverage} onChange={(e) => setSettingsForm((p) => ({ ...p, passAverage: Number(e.target.value) }))} />
        </label>
        <label className="text-sm text-brand-navy/70">
          {t("academicMaxAbsences")}
          <Input type="number" min="0" max="100" value={settingsForm.maxAbsencesPerCourse} onChange={(e) => setSettingsForm((p) => ({ ...p, maxAbsencesPerCourse: Number(e.target.value) }))} />
        </label>
        <label className="text-sm text-brand-navy/70">
          {t("academicLateDays")}
          <Input type="number" min="0" max="30" value={settingsForm.assignmentLateDaysLimit} onChange={(e) => setSettingsForm((p) => ({ ...p, assignmentLateDaysLimit: Number(e.target.value) }))} />
        </label>
        <label className="text-sm text-brand-navy/70">
          {t("academicReviewWindow")}
          <Input type="number" min="0" max="60" value={settingsForm.gradeReviewWindowDays} onChange={(e) => setSettingsForm((p) => ({ ...p, gradeReviewWindowDays: Number(e.target.value) }))} />
        </label>
        <Button variant="primary" type="submit" disabled={loading} className="md:col-span-2">
          {t("academicSaveSettings")}
        </Button>
      </form>
    </div>
  )
}
