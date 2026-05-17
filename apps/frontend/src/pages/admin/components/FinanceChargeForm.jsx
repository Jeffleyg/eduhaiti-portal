import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "../../../context/AuthContext.jsx"
import { apiFetch } from "../../../lib/api.js"
import Button from "../../../components/Button.jsx"
import Input from "../../../components/Input.jsx"
import LoadingState from "../../../components/LoadingState.jsx"
import { DollarSign, FileText, Percent, Calendar } from "lucide-react"

const initialForm = {
  studentEnrollmentNumber: "",
  amountHtg: "",
  dueDate: "",
  description: "",
  scholarshipPercent: "",
  scholarshipLabel: "",
  punctualityDiscountPercent: "",
  applyPunctualityDiscount: true,
}

function ChargeForm({ onSuccess, loading }) {
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
      await apiFetch("/finance/admin/tuition-charges", {
        method: "POST",
        token,
        body: {
          studentEnrollmentNumber: form.studentEnrollmentNumber,
          amountHtg: Number(form.amountHtg),
          dueDate: form.dueDate,
          description: form.description || undefined,
          scholarshipPercent: form.scholarshipPercent ? Number(form.scholarshipPercent) : undefined,
          scholarshipLabel: form.scholarshipLabel || undefined,
          punctualityDiscountPercent: form.punctualityDiscountPercent
            ? Number(form.punctualityDiscountPercent)
            : undefined,
          applyPunctualityDiscount: Boolean(form.applyPunctualityDiscount),
        },
      })
      setMessage(t("createChargeSuccess"))
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
          <label className="text-sm font-medium text-brand-navy">{t("amountPlaceholder")} *</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-brand-navy/40" />
            <Input
              type="number"
              min="1"
              step="0.01"
              value={form.amountHtg}
              onChange={(e) => setForm((prev) => ({ ...prev, amountHtg: e.target.value }))}
              placeholder={t("amountPlaceholder")}
              className="pl-8"
              required
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-brand-navy">{t("dueDate")} *</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-brand-navy/40" />
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              className="pl-8"
              required
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-brand-navy">{t("description") || 'Description'}</label>
          <Input
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder={t("invoiceItemDescription")}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-brand-navy">{t("scholarship") || 'Scholarship (%)'}</label>
          <div className="relative">
            <Percent className="absolute left-3 top-3 h-4 w-4 text-brand-navy/40" />
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.scholarshipPercent}
              onChange={(e) => setForm((prev) => ({ ...prev, scholarshipPercent: e.target.value }))}
              placeholder="0"
              className="pl-8"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-brand-navy">{t("scholarshipLabel") || 'Scholarship name'}</label>
          <Input
            value={form.scholarshipLabel}
            onChange={(e) => setForm((prev) => ({ ...prev, scholarshipLabel: e.target.value }))}
            placeholder="Ex: Mérito acadêmico"
          />
        </div>
        <div className="md:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.applyPunctualityDiscount}
              onChange={(e) => setForm((prev) => ({ ...prev, applyPunctualityDiscount: e.target.checked }))}
              className="h-4 w-4 rounded border-brand-navy/20"
            />
            <span className="text-sm text-brand-navy">{t("applyPunctualityDiscount") || 'Apply punctuality discount'}</span>
          </label>
        </div>
        <div>
          <label className="text-sm font-medium text-brand-navy">{t("punctualityDiscount") || 'Punctuality discount (%)'}</label>
          <div className="relative">
            <Percent className="absolute left-3 top-3 h-4 w-4 text-brand-navy/40" />
            <Input
              type="number"
              min="0"
              max="30"
              step="0.01"
              value={form.punctualityDiscountPercent}
              onChange={(e) => setForm((prev) => ({ ...prev, punctualityDiscountPercent: e.target.value }))}
              placeholder="0"
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <Button type="submit" variant="primary" disabled={loading} fullWidth>
        {loading ? t("sending") : t("createCharge")}
      </Button>
    </form>
  )
}

export default ChargeForm
