import React from "react"
import Button from "../Button.jsx"
import Input from "../Input.jsx"

export default function PeriodForm({ t, periodForm, setPeriodForm, createPeriod, loading }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-brand-navy">{t("academicCreatePeriod")}</h3>
      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createPeriod}>
        <Input
          value={periodForm.name}
          onChange={(e) => setPeriodForm((p) => ({ ...p, name: e.target.value }))}
          placeholder={t("academicPeriodName")}
          required
        />
        <Input type="date" value={periodForm.startDate} onChange={(e) => setPeriodForm((p) => ({ ...p, startDate: e.target.value }))} required />
        <Input type="date" value={periodForm.endDate} onChange={(e) => setPeriodForm((p) => ({ ...p, endDate: e.target.value }))} required />
        <Input value={periodForm.description} onChange={(e) => setPeriodForm((p) => ({ ...p, description: e.target.value }))} placeholder={t("academicPeriodDescription")} />
        <Button variant="primary" type="submit" disabled={loading} className="md:col-span-2">
          {t("academicCreatePeriodAction")}
        </Button>
      </form>
    </div>
  )
}
