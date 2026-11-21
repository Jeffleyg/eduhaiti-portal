import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Download, FileSpreadsheet, FileText, ShieldAlert, ShieldCheck } from "lucide-react"
import { useAuth } from "../../../context/AuthContext.jsx"
import { apiFetch, apiFetchRaw } from "../../../lib/api.js"
import { buildFinanceReportPdf, periodLabel } from "../../../lib/financeReportPdf.js"
import { downloadBlob, fileNameFrom, presetRange } from "../../../lib/download.js"

const PRESETS = ["month", "previousMonth", "schoolYear", "all", "custom"]
const STATUSES = ["ALL", "PENDING", "PARTIAL", "PAID", "OVERDUE"]
const STATUS_KEYS = {
  ALL: "allStatuses",
  PENDING: "paymentStatusPending",
  PARTIAL: "paymentStatusPartial",
  PAID: "paymentStatusPaid",
  OVERDUE: "paymentStatusOverdue",
}
const LEDGER_CATEGORIES = [
  "tuition-charge",
  "guardian-tuition",
  "mobile-money",
  "diaspora-remittance",
  "installment-plan",
  "finance-audit-report",
]

function FinanceReports() {
  const { t, i18n } = useTranslation()
  const { token } = useAuth()
  const [preset, setPreset] = useState("schoolYear")
  const [custom, setCustom] = useState({ startDate: "", endDate: "" })
  const [status, setStatus] = useState("ALL")
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [audit, setAudit] = useState(null)

  const range = preset === "custom" ? custom : presetRange(preset)
  const query = () => {
    const params = new URLSearchParams()
    if (range.startDate) params.set("startDate", range.startDate)
    // Inclusive end date: payments due at any time that day.
    if (range.endDate) params.set("endDate", `${range.endDate}T23:59:59.999Z`)
    if (status !== "ALL") params.set("status", status)
    return params
  }

  const run = async (kind, task) => {
    if (preset === "custom" && custom.startDate && custom.endDate && custom.endDate < custom.startDate) {
      setError(t("financeInvalidRange"))
      return
    }
    setBusy(kind)
    setError("")
    setNotice("")
    try {
      await task()
    } catch {
      setError(t("financeExportError"))
    } finally {
      setBusy("")
    }
  }

  const exportCsv = () =>
    run("csv", async () => {
      const params = query()
      params.set("lang", (i18n.resolvedLanguage || i18n.language || "fr").slice(0, 2))
      const response = await apiFetchRaw(`/finance/admin/payments/export?${params}`, { token })
      const blob = await response.blob()
      downloadBlob(blob, fileNameFrom(response.headers.get("content-disposition"), "paiements.csv"))
      setNotice(t("financeCsvReady"))
    })

  const exportPdf = () =>
    run("pdf", async () => {
      const report = await apiFetch(`/finance/admin/payments/report?${query()}`, { token })
      if (!report.rows?.length) {
        setNotice(t("financeNothingToExport"))
        return
      }
      buildFinanceReportPdf(report, t).save(`rapport-paiements-${new Date().toISOString().slice(0, 10)}.pdf`)
      setNotice(t("financePdfReady"))
    })

  const checkAudit = () =>
    run("audit", async () => {
      const params = new URLSearchParams()
      if (range.startDate) params.set("startDate", range.startDate)
      if (range.endDate) params.set("endDate", `${range.endDate}T23:59:59.999Z`)
      params.set("limit", "2000")
      setAudit(await apiFetch(`/finance/admin/audit-report?${params}`, { token }))
    })

  const downloadAudit = () => {
    const blob = new Blob([JSON.stringify(audit, null, 2)], { type: "application/json" })
    downloadBlob(blob, `audit-financier-${audit.generatedAt.slice(0, 10)}.json`)
  }

  const label = "text-xs font-semibold uppercase tracking-[0.15em] text-brand-navy/60"
  const input = "mt-1.5 w-full rounded-2xl border border-brand-navy/15 bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy/40"

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-2xl bg-brand-navy/5 p-4">
        <div>
          <p className={label} id="finance-period-label">{t("financePeriod")}</p>
          <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-labelledby="finance-period-label">
            {PRESETS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={preset === key}
                onClick={() => setPreset(key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  preset === key ? "border-brand-navy bg-brand-navy text-white" : "border-brand-navy/15 bg-white text-brand-navy hover:bg-white/60"
                }`}
              >
                {t(`financePreset_${key}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {preset === "custom" ? (
            <>
              <div>
                <label htmlFor="finance-start" className={label}>{t("financeFrom")}</label>
                <input id="finance-start" type="date" className={input} value={custom.startDate} onChange={(e) => setCustom((c) => ({ ...c, startDate: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="finance-end" className={label}>{t("financeTo")}</label>
                <input id="finance-end" type="date" className={input} value={custom.endDate} onChange={(e) => setCustom((c) => ({ ...c, endDate: e.target.value }))} />
              </div>
            </>
          ) : null}
          <div>
            <label htmlFor="finance-status" className={label}>{t("status")}</label>
            <select id="finance-status" className={input} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((key) => (
                <option key={key} value={key}>{t(STATUS_KEYS[key])}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-brand-navy/65">{periodLabel(range, t)}</p>
      </div>

      {notice ? <p role="status" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="flex flex-col rounded-2xl border border-brand-navy/10 bg-white p-5">
          <FileSpreadsheet className="h-6 w-6 text-emerald-700" aria-hidden="true" />
          <h3 className="mt-3 font-semibold text-brand-navy">{t("financeCsvTitle")}</h3>
          <p className="mt-1 flex-1 text-sm text-brand-navy/65">{t("financeCsvText")}</p>
          <button type="button" onClick={exportCsv} disabled={Boolean(busy)} className="primary-button mt-4 inline-flex items-center justify-center gap-2">
            <Download className="h-4 w-4" aria-hidden="true" />
            {busy === "csv" ? t("loading") : t("financeCsvAction")}
          </button>
        </section>

        <section className="flex flex-col rounded-2xl border border-brand-navy/10 bg-white p-5">
          <FileText className="h-6 w-6 text-brand-red" aria-hidden="true" />
          <h3 className="mt-3 font-semibold text-brand-navy">{t("financePdfTitle")}</h3>
          <p className="mt-1 flex-1 text-sm text-brand-navy/65">{t("financePdfText")}</p>
          <button type="button" onClick={exportPdf} disabled={Boolean(busy)} className="primary-button mt-4 inline-flex items-center justify-center gap-2">
            <Download className="h-4 w-4" aria-hidden="true" />
            {busy === "pdf" ? t("loading") : t("financePdfAction")}
          </button>
        </section>

        <section className="flex flex-col rounded-2xl border border-brand-navy/10 bg-white p-5">
          <ShieldCheck className="h-6 w-6 text-brand-navy" aria-hidden="true" />
          <h3 className="mt-3 font-semibold text-brand-navy">{t("financeAuditTitle")}</h3>
          <p className="mt-1 flex-1 text-sm text-brand-navy/65">{t("financeAuditText")}</p>
          <button
            type="button"
            onClick={checkAudit}
            disabled={Boolean(busy)}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-navy/20 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-navy/5 disabled:opacity-60"
          >
            {busy === "audit" ? t("loading") : t("financeAuditAction")}
          </button>
        </section>
      </div>

      {audit ? (
        <section aria-live="polite" className={`rounded-2xl border p-5 ${audit.integrity.valid ? "border-emerald-300 bg-emerald-50" : "border-brand-red/40 bg-brand-red/10"}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              {audit.integrity.valid ? (
                <ShieldCheck className="h-7 w-7 shrink-0 text-emerald-700" aria-hidden="true" />
              ) : (
                <ShieldAlert className="h-7 w-7 shrink-0 text-brand-red" aria-hidden="true" />
              )}
              <div>
                <p className="font-semibold text-brand-navy">
                  {audit.integrity.valid ? t("financeAuditValid") : t("financeAuditBroken", { index: audit.integrity.brokenAtIndex })}
                </p>
                <p className="mt-1 text-sm text-brand-navy/70">{t("financeAuditRecords", { count: audit.totalRecords })}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-brand-navy/55" title={audit.lastHash}>
                  {t("financeAuditSeal")}: {audit.lastHash.slice(0, 16)}…
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadAudit}
              className="inline-flex items-center gap-2 self-start rounded-2xl border border-brand-navy/20 bg-white px-3 py-2 text-xs font-semibold text-brand-navy hover:bg-brand-navy/5"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {t("financeAuditDownload")}
            </button>
          </div>
          {Object.keys(audit.byCategory).length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {LEDGER_CATEGORIES.filter((key) => audit.byCategory[key]).map((key) => (
                <li key={key} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-navy">
                  {t(`ledger_${key}`)} · {audit.byCategory[key]}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

export default FinanceReports
