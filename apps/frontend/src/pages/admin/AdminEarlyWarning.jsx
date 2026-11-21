import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowDownRight, ArrowUpRight, BellRing, CheckCircle2, LifeBuoy, Phone, TrendingDown, UserX, Users } from "lucide-react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import { displayName } from "../../lib/string.js"
import { relativeTime } from "../../components/announcements/announcementMeta.js"

const pct = (rate) => `${Math.round((rate ?? 0) * 100)} %`
const score = (value) => (value === null || value === undefined ? "–" : `${value.toFixed(1).replace(".", ",")}/20`)

/** Both reasons first, then the highest absence rate. */
const severity = (row) => Number(row.chronicAbsence) + Number(row.suddenGradeDrop)
const byPriority = (a, b) => severity(b) - severity(a) || b.currentAbsenceRate - a.currentAbsenceRate

function Delta({ value, unit, invert = false }) {
  if (!value) return null
  const worse = invert ? value < 0 : value > 0
  const Arrow = value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center text-xs font-semibold ${worse ? "text-brand-red" : "text-emerald-700"}`}>
      <Arrow className="h-3.5 w-3.5" aria-hidden="true" />
      {value > 0 ? "+" : ""}
      {unit === "pts" ? value.toFixed(1).replace(".", ",") : Math.round(value * 100)}
      {unit === "pts" ? "" : " pts"}
    </span>
  )
}

function StudentCard({ row }) {
  const { t } = useTranslation()
  return (
    <article className="rounded-2xl border border-brand-navy/10 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-brand-navy">{displayName(row.studentName) || row.enrollmentNumber}</h3>
          <p className="text-xs text-brand-navy/55">{[row.enrollmentNumber, row.className].filter(Boolean).join(" · ") || "–"}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {row.chronicAbsence ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-red/10 px-2 py-0.5 text-[11px] font-semibold text-brand-red">
              <UserX className="h-3 w-3" aria-hidden="true" />
              {t("earlyChronicAbsence")}
            </span>
          ) : null}
          {row.suddenGradeDrop ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
              {t("earlyGradeDrop")}
            </span>
          ) : null}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-brand-navy/5 p-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-brand-navy/55">{t("earlyAbsences")}</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 font-semibold text-brand-navy">
            {pct(row.currentAbsenceRate)}
            <Delta value={row.absenceDelta} />
          </dd>
          <dd className="text-xs text-brand-navy/60">{t("earlyAbsencesDetail", { absent: row.currentAbsences, count: row.currentRecords })}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-brand-navy/55">{t("dashboardAverage")}</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 font-semibold text-brand-navy">
            {score(row.currentAverage)}
            <Delta value={row.gradeDelta} unit="pts" invert />
          </dd>
          <dd className="text-xs text-brand-navy/60">{t("earlyPreviousAverage", { value: score(row.previousAverage) })}</dd>
        </div>
      </dl>

      <div className="mt-3 space-y-1 text-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy/55">{t("earlyFamily")}</p>
        {row.guardians.length > 0 ? (
          row.guardians.map((guardian) => (
            <p key={`${guardian.name}-${guardian.phone}`} className="flex flex-wrap items-center gap-x-2 text-brand-navy">
              <span className="font-medium">{guardian.name}</span>
              {guardian.relationship ? <span className="text-xs text-brand-navy/55">({guardian.relationship})</span> : null}
              <a href={`tel:${guardian.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {guardian.phone}
              </a>
            </p>
          ))
        ) : (
          <p className="text-brand-navy/65">
            {row.guardianFallbackName ? `${row.guardianFallbackName} · ` : ""}
            <span className="text-xs">{t("earlyNoGuardianPhone")}</span>
          </p>
        )}
      </div>

      {row.lastAlertAt ? (
        <p className="mt-3 border-t border-brand-navy/5 pt-2 text-xs text-brand-navy/55">
          {t("earlyLastAlert", { when: relativeTime(row.lastAlertAt) })}
        </p>
      ) : null}
    </article>
  )
}

function AdminEarlyWarning() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    try {
      const result = await apiFetch("/analytics/dashboard/early-alert", { token })
      setData({ report: result?.report ?? [], rules: result?.rules ?? null })
      setError("")
    } catch {
      setError(t("earlyLoadError"))
    }
  }, [token, t])

  useEffect(() => {
    load()
  }, [load])

  const sendAlerts = async () => {
    setSending(true)
    setNotice("")
    setError("")
    try {
      const result = await apiFetch("/analytics/dashboard/early-alert/trigger", { method: "POST", token })
      const { triggered = 0, skipped = 0, recipients = 0 } = result?.notification ?? {}
      setNotice(
        triggered === 0
          ? t("earlyAllAlreadySent", { count: skipped })
          : t("earlySent", { count: triggered, recipients }) + (skipped ? ` ${t("earlySkipped", { count: skipped })}` : ""),
      )
      await load()
    } catch {
      setError(t("earlySendError"))
    } finally {
      setSending(false)
    }
  }

  if (!data) {
    return error ? (
      <p role="alert" className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-brand-red">{error}</p>
    ) : (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-busy="true">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-28 animate-pulse rounded-3xl bg-brand-navy/5" />
        ))}
      </div>
    )
  }

  const atRisk = data.report.filter((row) => row.atRisk).sort(byPriority)
  const rules = data.rules
  const kpis = [
    { icon: LifeBuoy, label: t("earlyAtRisk"), value: atRisk.length },
    { icon: UserX, label: t("earlyChronicAbsence"), value: atRisk.filter((r) => r.chronicAbsence).length },
    { icon: TrendingDown, label: t("earlyGradeDrop"), value: atRisk.filter((r) => r.suddenGradeDrop).length },
    { icon: Users, label: t("earlyAnalysed"), value: data.report.length },
  ]

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-3xl border border-brand-navy/10 bg-white/90 p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-display text-xl text-brand-navy">{t("earlyHowTitle")}</h2>
          {rules ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-brand-navy/70">
              <li>{t("earlyRuleAbsence", { absences: rules.chronicAbsences, rate: pct(rules.chronicRate), records: rules.minRecordsForRate, days: rules.windowDays })}</li>
              <li>{t("earlyRuleGrades", { points: rules.gradeDrop, days: rules.windowDays })}</li>
              <li>{t("earlyRuleCooldown", { days: rules.alertCooldownDays })}</li>
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          onClick={sendAlerts}
          disabled={sending || atRisk.length === 0}
          className="primary-button inline-flex shrink-0 items-center justify-center gap-2 disabled:opacity-50"
        >
          <BellRing className="h-4 w-4" aria-hidden="true" />
          {sending ? t("loading") : t("earlySendAction")}
        </button>
      </section>

      {notice ? <p role="status" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map(({ icon: Icon, label, value }) => (
          <div key={label} className="min-w-0 rounded-3xl border border-brand-navy/10 bg-white/90 p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-navy/60 sm:text-xs">{label}</p>
              <Icon className="hidden h-4 w-4 shrink-0 text-brand-navy/50 sm:block" aria-hidden="true" />
            </div>
            <p className="mt-2 font-display text-2xl text-brand-navy sm:text-3xl">{value}</p>
          </div>
        ))}
      </div>

      {atRisk.length === 0 ? (
        <div className="rounded-3xl border border-emerald-300 bg-emerald-50 p-8 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-700" aria-hidden="true" />
          <p className="mt-3 font-semibold text-emerald-900">{t("earlyNoneTitle")}</p>
          <p className="mt-1 text-sm text-emerald-800">{t("earlyNoneText", { count: data.report.length })}</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {atRisk.map((row) => (
            <StudentCard key={row.studentId} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

export default AdminEarlyWarning
