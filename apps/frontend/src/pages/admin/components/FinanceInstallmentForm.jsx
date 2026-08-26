import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "../../../context/AuthContext.jsx"
import { apiFetch } from "../../../lib/api.js"
import Button from "../../../components/Button.jsx"
import Input from "../../../components/Input.jsx"
import LoadingState from "../../../components/LoadingState.jsx"
import { Calendar, Percent, DollarSign } from "lucide-react"

const initialForm = {
  studentEnrollmentNumber: "",
  installments: "3",
  firstDueDate: "",
  intervalDays: "30",
  customTotalAmountHtg: "",
  markSourceAsRenegotiated: true,
  description: "",
}

function InstallmentPlanForm({ onSuccess, loading }) {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")
    setMessage("")

    try {
      const result = await apiFetch("/finance/admin/installment-plans", {
        method: "POST",
        token,
        body: {
          studentEnrollmentNumber: form.studentEnrollmentNumber,
          installments: Number(form.installments),
          firstDueDate: form.firstDueDate,
          intervalDays: form.intervalDays ? Number(form.intervalDays) : undefined,
          customTotalAmountHtg: form.customTotalAmountHtg ? Number(form.customTotalAmountHtg) : undefined,
          markSourceAsRenegotiated: Boolean(form.markSourceAsRenegotiated),
          description: form.description || undefined,
        },
      })

      setMessage(t("installmentCreated", { planId: result.planId, count: result.installments?.length ?? 0 }))
      setForm(initialForm)
      onSuccess?.()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <LoadingState type="banner" error={error} message={error} />}
      {message && <LoadingState type="banner" success message={message} />}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-brand-navy">{t("enrollmentLabel")} *</label>
          <Input
            value={form.studentEnrollmentNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, studentEnrollmentNumber: e.target.value }))}
            placeholder={t("enrollmentPlaceholderPayment")}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-brand-navy">{t("installmentsLabel")}</label>
          <Input
            type="number"
            min="2"
            max="36"
            value={form.installments}
            onChange={(e) => setForm((prev) => ({ ...prev, installments: e.target.value }))}
            placeholder="3"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-brand-navy">{t("firstDueDate")}</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-brand-navy/40" />
            <Input
              type="date"
              value={form.firstDueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, firstDueDate: e.target.value }))}
              className="pl-8"
              required
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-brand-navy">{t("intervalBetweenInstallments")}</label>
          <Input
            type="number"
            min="7"
            max="90"
            value={form.intervalDays}
            onChange={(e) => setForm((prev) => ({ ...prev, intervalDays: e.target.value }))}
            placeholder="30"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-brand-navy">{t("customTotalAmountLabel")}</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-brand-navy/40" />
            <Input
              type="number"
              min="1"
              step="0.01"
              value={form.customTotalAmountHtg}
              onChange={(e) => setForm((prev) => ({ ...prev, customTotalAmountHtg: e.target.value }))}
              placeholder={t("leaveBlankToUseOriginal")}
              className="pl-8"
            />
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-brand-navy">{t("agreementDescription")}</label>
          <Input
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder={t("agreementDescriptionPlaceholder")}
          />
        </div>
        <div className="md:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.markSourceAsRenegotiated}
              onChange={(e) => setForm((prev) => ({ ...prev, markSourceAsRenegotiated: e.target.checked }))}
              className="h-4 w-4 rounded border-brand-navy/20"
            />
            <span className="text-sm text-brand-navy">{t("markOldDebtsRenegotiated")}</span>
          </label>
        </div>
      </div>

      <Button type="submit" variant="primary" disabled={loading} fullWidth>
        {loading ? t("sending") : t("generateInstallment")}
      </Button>
    </form>
  )
}

export default InstallmentPlanForm
