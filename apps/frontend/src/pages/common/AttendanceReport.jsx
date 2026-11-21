import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock, Download, FileText, Search, UserX, Users } from "lucide-react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch, apiFetchRaw } from "../../lib/api.js"
import { uiLocale } from "../../lib/locale.js"
import { downloadBlob, fileNameFrom, presetRange } from "../../lib/download.js"
import { attendancePeriodLabel, buildAttendanceReportPdf, percent } from "../../lib/attendanceReportPdf.js"
import { trendBuckets } from "../../lib/attendanceTrend.js"

const PRESETS = ["last30", "month", "previousMonth", "schoolYear", "custom"]
// Single-series chart color, validated for contrast (same as the admin dashboard).
const SERIES = "bg-sky-600"
const WATCH = 0.8
const CRITICAL = 0.65

function standing(rate) {
  if (rate === null || rate === undefined) return null
  if (rate < CRITICAL) return { key: "attendanceCritical", icon: AlertTriangle, className: "bg-brand-red/10 text-brand-red" }
  if (rate < WATCH) return { key: "attendanceWatch", icon: Clock, className: "bg-amber-100 text-amber-800" }
  return { key: "attendanceRegular", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-800" }
}

function Standing({ rate }) {
  const { t } = useTranslation()
  const info = standing(rate)
  if (!info) return <span className="text-xs text-brand-navy/50">–</span>
  const Icon = info.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${info.className}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(info.key)}
    </span>
  )
}

function TrendChart({ daily }) {
  const { t } = useTranslation()
  const buckets = trendBuckets(daily)
  const label = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(uiLocale(), { day: "2-digit", month: "short", timeZone: "UTC" })
  const step = Math.max(1, Math.ceil(buckets.length / 8))
  return (
    <div>
      <div className="relative h-40" aria-hidden="true">
        {[1, 0.5, 0].map((line) => (
          <div key={line} className="absolute inset-x-0 border-t border-brand-navy/10" style={{ bottom: `${line * 100}%` }}>
            <span className="absolute -top-2 left-0 bg-white pr-1 text-[10px] text-brand-navy/45">{line * 100}%</span>
          </div>
        ))}
        <div className="absolute inset-0 left-9 flex items-end gap-1">
          {buckets.map((b) => (
            <div key={b.key} className="group relative flex h-full flex-1 items-end justify-center">
              <div className={`w-full max-w-6 rounded-t ${SERIES} opacity-85 group-hover:opacity-100`} style={{ height: `${Math.max((b.rate ?? 0) * 100, 2)}%` }} />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-brand-navy px-2 py-1 text-[11px] text-white shadow group-hover:block">
                {b.weekly ? t("dashboardWeekOf", { date: label(b.start) }) : label(b.start)} · {percent(b.rate)} · {t("dashboardRecords", { count: b.records })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="ml-9 mt-2 flex gap-1" aria-hidden="true">
        {buckets.map((b, index) => (
          <span key={b.key} className="flex-1 truncate text-center text-[10px] text-brand-navy/50">
            {index % step === 0 ? label(b.start) : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{t("attendanceTrend")}</caption>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.key}>
              <th scope="row">{label(b.start)}</th>
              <td>{percent(b.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, hint }) {
  return (
    <div className="min-w-0 rounded-3xl border border-brand-navy/10 bg-white/90 p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-navy/60 sm:text-xs">{label}</p>
        <Icon className="hidden h-4 w-4 shrink-0 text-brand-navy/50 sm:block" aria-hidden="true" />
      </div>
      <p className="mt-2 font-display text-2xl text-brand-navy sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-brand-navy/60">{hint}</p> : null}
    </div>
  )
}

function RateBar({ rate }) {
  if (rate === null || rate === undefined) return null
  return (
    <div className="h-1.5 w-20 rounded-full bg-brand-navy/10" aria-hidden="true">
      <div className={`h-1.5 rounded-full ${SERIES}`} style={{ width: `${rate * 100}%` }} />
    </div>
  )
}

function AttendanceReport() {
  const { t, i18n } = useTranslation()
  const { token } = useAuth()
  const [preset, setPreset] = useState("last30")
  const [custom, setCustom] = useState({ startDate: "", endDate: "" })
  const [classId, setClassId] = useState("")
  const [classOptions, setClassOptions] = useState([])
  const [report, setReport] = useState(null)
  // The query whose answer is on screen: loading = a different query is pending.
  const [loadedKey, setLoadedKey] = useState(null)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [onlyAlerts, setOnlyAlerts] = useState(false)

  const range = preset === "custom" ? custom : presetRange(preset)
  const invalidRange = Boolean(range.startDate && range.endDate && range.endDate < range.startDate)
  const params = useCallback(() => {
    const query = new URLSearchParams()
    if (classId) query.set("classId", classId)
    if (range.startDate) query.set("startDate", range.startDate)
    // Inclusive end date: roll calls taken at any time that day.
    if (range.endDate) query.set("endDate", `${range.endDate}T23:59:59.999Z`)
    return query
  }, [classId, range.startDate, range.endDate])

  const requestKey = params().toString()
  const canLoad = Boolean(token) && !invalidRange
  const loading = canLoad && loadedKey !== requestKey

  useEffect(() => {
    if (!canLoad) return undefined
    let active = true
    apiFetch(`/attendance/report?${requestKey}`, { token })
      .then((result) => {
        if (!active) return
        setReport(result)
        setError("")
        // The class list comes from the school-wide (or teacher-wide) report.
        if (!classId) setClassOptions(result.classes.map((c) => ({ id: c.id, name: c.name })))
      })
      .catch(() => active && setError(t("attendanceLoadError")))
      .finally(() => active && setLoadedKey(requestKey))
    return () => {
      active = false
    }
  }, [canLoad, token, requestKey, classId, t])

  const scopeLabel = classId ? classOptions.find((c) => c.id === classId)?.name ?? "" : t("attendanceAllClasses")

  const exportCsv = async () => {
    setBusy("csv")
    setError("")
    try {
      const query = params()
      query.set("lang", (i18n.resolvedLanguage || i18n.language || "fr").slice(0, 2))
      const response = await apiFetchRaw(`/attendance/report/export?${query}`, { token })
      downloadBlob(await response.blob(), fileNameFrom(response.headers.get("content-disposition"), "presences.csv"))
    } catch {
      setError(t("financeExportError"))
    } finally {
      setBusy("")
    }
  }

  const exportPdf = () => {
    buildAttendanceReportPdf(report, { scopeLabel, t }).save(`rapport-presences-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const term = search.trim().toLowerCase()
  const students = (report?.students ?? []).filter((row) => {
    if (onlyAlerts && !(row.rate !== null && row.rate < WATCH)) return false
    if (!term) return true
    return [row.name, row.enrollmentNumber, row.className].some((value) => (value ?? "").toLowerCase().includes(term))
  })
  const alertCount = (report?.students ?? []).filter((row) => row.rate !== null && row.rate < WATCH).length
  const hasRecords = (report?.totals.records ?? 0) > 0

  const label = "text-xs font-semibold uppercase tracking-[0.15em] text-brand-navy/60"
  const input = "mt-1.5 w-full rounded-2xl border border-brand-navy/15 bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy/40"

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-3xl border border-brand-navy/10 bg-white/90 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className={label} id="attendance-period-label">{t("attendancePeriod")}</p>
            <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-labelledby="attendance-period-label">
              {PRESETS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={preset === key}
                  onClick={() => setPreset(key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    preset === key ? "border-brand-navy bg-brand-navy text-white" : "border-brand-navy/15 bg-white text-brand-navy hover:bg-brand-navy/5"
                  }`}
                >
                  {t(key === "last30" ? "attendancePreset_last30" : `financePreset_${key}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={!hasRecords || Boolean(busy)}
              className="inline-flex items-center gap-2 rounded-2xl border border-brand-navy/20 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-navy/5 disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {busy === "csv" ? t("loading") : t("financeCsvTitle")}
            </button>
            <button type="button" onClick={exportPdf} disabled={!hasRecords || Boolean(busy)} className="primary-button inline-flex items-center gap-2 disabled:opacity-50">
              <FileText className="h-4 w-4" aria-hidden="true" />
              {t("financePdfTitle")}
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="attendance-class" className={label}>{t("dashboardClass")}</label>
            <select id="attendance-class" className={input} value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">{t("attendanceAllClasses")}</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {preset === "custom" ? (
            <>
              <div>
                <label htmlFor="attendance-start" className={label}>{t("financeFrom")}</label>
                <input id="attendance-start" type="date" className={input} value={custom.startDate} onChange={(e) => setCustom((c) => ({ ...c, startDate: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="attendance-end" className={label}>{t("financeTo")}</label>
                <input id="attendance-end" type="date" className={input} value={custom.endDate} onChange={(e) => setCustom((c) => ({ ...c, endDate: e.target.value }))} />
              </div>
            </>
          ) : null}
        </div>
        <p className="text-xs text-brand-navy/65">
          {scopeLabel} · {attendancePeriodLabel(range, t)}
        </p>
        {invalidRange ? <p role="alert" className="text-sm text-brand-red">{t("financeInvalidRange")}</p> : null}
      </section>

      {error ? <p role="alert" className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">{error}</p> : null}

      {loading && !report ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="h-28 animate-pulse rounded-3xl bg-brand-navy/5" />
          ))}
        </div>
      ) : report ? (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi icon={ClipboardCheck} label={t("attendanceRateLabel")} value={percent(report.totals.rate)} hint={t("attendanceRecordsCount", { count: report.totals.records })} />
            <Kpi icon={UserX} label={t("attendanceAbsences")} value={report.totals.absent} hint={report.totals.excused > 0 ? t("attendanceExcusedCount", { count: report.totals.excused }) : null} />
            <Kpi icon={Clock} label={t("attendanceLates")} value={report.totals.late} />
            <Kpi icon={Users} label={t("attendanceStudentsFollowed")} value={report.totals.students} hint={t("attendanceAlertCount", { count: alertCount })} />
          </div>

          {!classId && report.totals.classesWithoutRecords > 0 ? (
            <p className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {t("attendanceClassesWithoutRecords", { count: report.totals.classesWithoutRecords })}
            </p>
          ) : null}

          {!hasRecords ? (
            <div className="rounded-3xl border border-dashed border-brand-navy/15 bg-white/70 p-10 text-center">
              <ClipboardCheck className="mx-auto h-8 w-8 text-brand-navy/30" aria-hidden="true" />
              <p className="mt-3 text-sm text-brand-navy/60">{t("attendanceNoRecords")}</p>
            </div>
          ) : (
            <section className="rounded-3xl border border-brand-navy/10 bg-white/90 p-5 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-brand-navy">{t("attendanceTrend")}</h2>
              <TrendChart daily={report.daily} />
            </section>
          )}

          {!classId && report.classes.length > 1 ? (
            <section className="min-w-0 rounded-3xl border border-brand-navy/10 bg-white/90 p-5 shadow-sm">
              <h2 className="mb-3 text-base font-semibold text-brand-navy">{t("attendanceByClass")}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-brand-navy/50">
                      <th className="pb-2 font-semibold">{t("dashboardClass")}</th>
                      <th className="hidden pb-2 font-semibold sm:table-cell">{t("attendanceTeacher")}</th>
                      <th className="pb-2 text-right font-semibold">{t("attendanceRecordsCol")}</th>
                      <th className="pb-2 text-right font-semibold">{t("attendanceRateLabel")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-navy/5">
                    {report.classes.map((row) => (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap py-2.5 pr-3">
                          <button type="button" onClick={() => setClassId(row.id)} className="font-semibold text-brand-navy hover:underline">
                            {row.name}
                          </button>
                          <p className="text-xs text-brand-navy/55">{t("attendanceStudentsN", { count: row.students })}</p>
                        </td>
                        <td className="hidden py-2.5 pr-3 text-brand-navy/75 sm:table-cell">{row.teacherName ?? "–"}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-brand-navy/75">{row.records}</td>
                        <td className="py-2.5 text-right">
                          {row.records === 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                              {t("attendanceNoRollCall")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-end gap-2">
                              <RateBar rate={row.rate} />
                              <span className="w-10 text-right font-semibold tabular-nums text-brand-navy">{percent(row.rate)}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {hasRecords ? (
            <section className="min-w-0 rounded-3xl border border-brand-navy/10 bg-white/90 p-5 shadow-sm">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold text-brand-navy">{t("attendanceByStudent")}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 rounded-2xl border border-brand-navy/15 px-3 py-1.5">
                    <Search className="h-4 w-4 text-brand-navy/50" aria-hidden="true" />
                    <span className="sr-only">{t("attendanceSearch")}</span>
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t("attendanceSearch")}
                      className="w-40 bg-transparent text-sm text-brand-navy outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    aria-pressed={onlyAlerts}
                    onClick={() => setOnlyAlerts((value) => !value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      onlyAlerts ? "border-brand-navy bg-brand-navy text-white" : "border-brand-navy/15 bg-white text-brand-navy hover:bg-brand-navy/5"
                    }`}
                  >
                    {t("attendanceOnlyAlerts", { count: alertCount })}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-brand-navy/50">
                      <th className="pb-2 font-semibold">{t("financeColStudent")}</th>
                      <th className="pb-2 font-semibold">{t("dashboardClass")}</th>
                      <th className="pb-2 text-right font-semibold">{t("attendancePresentCol")}</th>
                      <th className="pb-2 text-right font-semibold">{t("attendanceLateCol")}</th>
                      <th className="pb-2 text-right font-semibold">{t("attendanceAbsentCol")}</th>
                      <th className="pb-2 text-right font-semibold">{t("attendanceRateLabel")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-navy/5">
                    {students.map((row) => (
                      <tr key={`${row.studentId}:${row.classId}`}>
                        <td className="py-2.5 pr-3">
                          <p className="font-semibold text-brand-navy">{row.name ?? "–"}</p>
                          <p className="text-xs text-brand-navy/55">{row.enrollmentNumber ?? "–"}</p>
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-3 text-brand-navy/75">{row.className ?? "–"}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{row.present}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{row.late}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{row.absent}</td>
                        <td className="py-2.5 text-right">
                          <span className="inline-flex flex-col items-end gap-1">
                            <span className="font-semibold tabular-nums text-brand-navy">{percent(row.rate)}</span>
                            <Standing rate={row.rate} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {students.length === 0 ? <p className="py-6 text-center text-sm text-brand-navy/60">{t("attendanceNoMatch")}</p> : null}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default AttendanceReport
