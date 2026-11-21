import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  GraduationCap,
  HandCoins,
  KeyRound,
  ListChecks,
  Mail,
  School,
  TrendingDown,
  UserPlus,
  Users,
  UserX,
} from "lucide-react"
import { useAuth } from "../../context/AuthContext.jsx"
import { useSurvivalMode } from "../../context/useSurvivalMode.js"
import { useSyncControl } from "../../context/useSyncControl.js"
import { apiFetch } from "../../lib/api.js"
import { uiLocale } from "../../lib/locale.js"
import { displayName } from "../../lib/string.js"
import { formatLastUpdated, readHomeCache, writeHomeCache } from "../../offline/sqliteCache"

// Own cache slot: the generic sync (SyncControlContext) writes its own payload
// under the role name "admin", which has a different shape.
const CACHE_KEY = "adminDashboard"
const PASS_MARK = 10
// Single-series chart color (Tailwind sky-600): passes the dataviz lightness,
// chroma and 3:1 contrast checks on the white card, unlike brand-sky.
const SERIES = "bg-sky-600"

// Guards against stale or foreign cache entries (e.g. an older app version).
const isDashboard = (value) =>
  Boolean(value?.headcount && value?.attendance?.weekly && value?.grades?.classes && value?.risk && value?.actions && value?.school)

const percent = (rate) => (rate == null ? "–" : `${Math.round(rate * 100)}%`)
const score = (value) => (value == null ? "–" : `${value.toFixed(1).replace(".", ",")}/20`)

function money(amount) {
  return new Intl.NumberFormat(uiLocale(), { style: "currency", currency: "HTG", maximumFractionDigits: 0 }).format(amount)
}

function Card({ title, icon: Icon, action, children, className = "" }) {
  return (
    <section className={`min-w-0 rounded-3xl border border-brand-navy/10 bg-white/90 p-5 shadow-sm sm:p-6 ${className}`}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-brand-navy">
          {Icon ? <Icon className="h-4 w-4 text-brand-navy/60" aria-hidden="true" /> : null}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function Kpi({ icon: Icon, label, value, detail, trend }) {
  return (
    <div className="min-w-0 rounded-3xl border border-brand-navy/10 bg-white/90 p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-navy/60 sm:text-xs">{label}</p>
        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-navy/5 text-brand-navy/70 sm:flex">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl text-brand-navy sm:mt-3 sm:text-3xl">{value}</p>
      <div className="mt-1 flex flex-col gap-0.5 text-xs text-brand-navy/60">
        {trend}
        <span>{detail}</span>
      </div>
    </div>
  )
}

/** Change against the previous 30 days, with an arrow so it is never color alone. */
function Trend({ current, previous }) {
  const { t } = useTranslation()
  if (current == null || previous == null) return null
  const points = Math.round((current - previous) * 100)
  if (points === 0) return <span className="font-semibold text-brand-navy/60">{t("dashboardStable")}</span>
  const up = points > 0
  const Arrow = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-start gap-0.5 font-semibold ${up ? "text-emerald-700" : "text-brand-red"}`}>
      <Arrow className="h-3.5 w-3.5" aria-hidden="true" />
      {t("dashboardPointsDelta", { value: `${up ? "+" : ""}${points}` })}
    </span>
  )
}

function AttendanceChart({ weeks }) {
  const { t } = useTranslation()
  const locale = uiLocale()
  const label = (iso) => new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short", timeZone: "UTC" })
  const hasData = weeks.some((week) => week.rate != null)

  if (!hasData) {
    return <p className="py-10 text-center text-sm text-brand-navy/60">{t("dashboardNoAttendance")}</p>
  }

  return (
    <div>
      <div className="relative h-44" aria-hidden="true">
        {[1, 0.5, 0].map((line) => (
          <div key={line} className="absolute inset-x-0 border-t border-brand-navy/10" style={{ bottom: `${line * 100}%` }}>
            <span className="absolute -top-2 left-0 bg-white pr-1 text-[10px] text-brand-navy/45">{line * 100}%</span>
          </div>
        ))}
        <div className="absolute inset-0 left-9 flex items-end gap-2">
          {weeks.map((week, index) => (
            <div key={week.weekStart} className="group relative flex h-full flex-1 items-end justify-center">
              {week.rate == null ? (
                <div className="h-0.5 w-full max-w-8 rounded bg-brand-navy/10" />
              ) : (
                <div
                  className={`w-full max-w-8 rounded-t ${SERIES} ${index === weeks.length - 1 ? "" : "opacity-80"} transition-opacity group-hover:opacity-100`}
                  style={{ height: `${Math.max(week.rate * 100, 2)}%` }}
                />
              )}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-brand-navy px-2 py-1 text-[11px] text-white shadow group-hover:block">
                {t("dashboardWeekOf", { date: label(week.weekStart) })} · {week.rate == null ? t("dashboardNoRecords") : `${percent(week.rate)} · ${t("dashboardRecords", { count: week.records })}`}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="ml-9 mt-2 flex gap-2" aria-hidden="true">
        {weeks.map((week, index) => (
          <span key={week.weekStart} className="flex-1 text-center text-[10px] text-brand-navy/50">
            {index % 2 === 1 || index === weeks.length - 1 ? label(week.weekStart) : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{t("dashboardAttendanceTrend")}</caption>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.weekStart}>
              <th scope="row">{label(week.weekStart)}</th>
              <td>{week.rate == null ? t("dashboardNoRecords") : percent(week.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ClassPerformance({ classes }) {
  const { t } = useTranslation()
  if (classes.length === 0) {
    return <p className="py-10 text-center text-sm text-brand-navy/60">{t("dashboardNoClasses")}</p>
  }
  const sorted = [...classes].sort((a, b) => (b.average ?? -1) - (a.average ?? -1))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-brand-navy/50">
            <th className="pb-2 font-semibold">{t("dashboardClass")}</th>
            <th className="pb-2 font-semibold">{t("dashboardAverage")}</th>
            <th className="pb-2 text-right font-semibold">{t("dashboardOccupancy")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-navy/5">
          {sorted.map((item) => (
            <tr key={item.id}>
              <td className="py-2.5 pr-3">
                <p className="whitespace-nowrap font-semibold text-brand-navy">{item.name}</p>
                <p className="text-xs text-brand-navy/55">
                  {item.level}
                  {item.hasTeacher ? "" : ` · ${t("dashboardNoTeacher")}`}
                </p>
              </td>
              <td className="w-1/2 py-2.5 pr-3 sm:w-3/5">
                {item.average == null ? (
                  <span className="text-xs text-brand-navy/50">{t("dashboardNoGrades")}</span>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="relative h-2 min-w-12 flex-1 rounded-full bg-brand-navy/5" title={score(item.average)}>
                      <div className={`h-2 rounded-full ${SERIES}`} style={{ width: `${(item.average / 20) * 100}%` }} />
                      {/* Pass mark reference */}
                      <div className="absolute -top-1 h-4 w-px bg-brand-navy/40" style={{ left: `${(PASS_MARK / 20) * 100}%` }} />
                    </div>
                    <span className="shrink-0 text-right text-xs font-semibold tabular-nums text-brand-navy">{score(item.average)}</span>
                  </div>
                )}
              </td>
              <td className="py-2.5 text-right text-xs tabular-nums text-brand-navy/70">
                {item.students}/{item.capacity}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 flex items-center gap-2 text-[11px] text-brand-navy/50">
        <span className="inline-block h-3 w-px bg-brand-navy/40" aria-hidden="true" />
        {t("dashboardPassMark", { value: PASS_MARK })}
      </p>
    </div>
  )
}

function ActionList({ actions }) {
  const { t } = useTranslation()
  const items = [
    { key: "noOpenPeriod", count: actions.noOpenPeriod ? 1 : 0, icon: CalendarClock, to: "/admin/academic", label: t("dashboardActionNoPeriod") },
    { key: "pendingRequests", count: actions.pendingRequests, icon: ListChecks, to: "/admin/academic-requests", label: t("dashboardActionRequests", { count: actions.pendingRequests }) },
    { key: "studentsWithoutClass", count: actions.studentsWithoutClass, icon: UserX, to: "/admin/students", label: t("dashboardActionNoClass", { count: actions.studentsWithoutClass }) },
    { key: "classesWithoutTeacher", count: actions.classesWithoutTeacher, icon: School, to: "/admin/classes", label: t("dashboardActionNoTeacher", { count: actions.classesWithoutTeacher }) },
    { key: "pendingActivation", count: actions.pendingActivation, icon: KeyRound, to: "/admin/users", label: t("dashboardActionActivation", { count: actions.pendingActivation }) },
    { key: "draftGrades", count: actions.draftGrades, icon: FileClock, label: t("dashboardActionDraftGrades", { count: actions.draftGrades }) },
  ].filter((item) => item.count > 0)

  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t("dashboardAllClear")}
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {items.map(({ key, icon: Icon, to, label }) => {
        const content = (
          <>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="flex-1 text-sm text-brand-navy">{label}</span>
            {to ? <ArrowRight className="h-4 w-4 text-brand-navy/40" aria-hidden="true" /> : null}
          </>
        )
        return (
          <li key={key}>
            {to ? (
              <Link to={to} className="flex items-center gap-3 rounded-2xl border border-brand-navy/10 p-3 transition-colors hover:border-brand-navy/25 hover:bg-brand-navy/5">
                {content}
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-brand-navy/10 p-3">{content}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function RiskList({ risk }) {
  const { t } = useTranslation()
  if (risk.count === 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t("dashboardNoRisk")}
      </p>
    )
  }
  return (
    <div>
      <ul className="divide-y divide-brand-navy/5">
        {risk.students.map((student) => (
          <li key={student.id} className="flex items-start justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand-navy">{displayName(student.name)}</p>
              <p className="text-xs text-brand-navy/55">{student.enrollmentNumber ?? "–"}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {student.chronicAbsence ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-red/10 px-2 py-0.5 text-[11px] font-semibold text-brand-red">
                  <UserX className="h-3 w-3" aria-hidden="true" />
                  {t("dashboardRiskAbsence", { value: percent(student.absenceRate) })}
                </span>
              ) : null}
              {student.suddenGradeDrop ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  <TrendingDown className="h-3 w-3" aria-hidden="true" />
                  {t("dashboardRiskGradeDrop", { value: student.gradeDelta.toFixed(1).replace(".", ",") })}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {risk.count > risk.students.length ? (
        <p className="mt-2 text-xs text-brand-navy/55">{t("dashboardRiskMore", { count: risk.count - risk.students.length })}</p>
      ) : null}
    </div>
  )
}

function FinanceSummary({ finance }) {
  const { t } = useTranslation()
  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      <div>
        <dt className="text-xs text-brand-navy/60">{t("dashboardCollectedMonth")}</dt>
        <dd className="mt-1 font-display text-2xl text-brand-navy">{money(finance.collectedThisMonth)}</dd>
        <dd className="text-xs text-brand-navy/55">{t("dashboardPreviousMonth", { value: money(finance.collectedPreviousMonth) })}</dd>
      </div>
      <div>
        <dt className="text-xs text-brand-navy/60">{t("dashboardOutstanding")}</dt>
        <dd className="mt-1 font-display text-2xl text-brand-navy">{money(finance.outstandingAmount)}</dd>
        <dd className="text-xs text-brand-navy/55">{t("dashboardOutstandingCount", { count: finance.outstandingCount })}</dd>
      </div>
      <div>
        <dt className="text-xs text-brand-navy/60">{t("dashboardOverdue")}</dt>
        <dd className="mt-1 flex items-center gap-2 font-display text-2xl text-brand-navy">
          {finance.overdueCount}
          {finance.overdueCount > 0 ? <AlertTriangle className="h-5 w-5 text-amber-600" aria-label={t("dashboardOverdue")} /> : null}
        </dd>
        <dd className="text-xs text-brand-navy/55">{t("dashboardOverdueHint")}</dd>
      </div>
    </dl>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-20 animate-pulse rounded-3xl bg-brand-navy/5" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-36 animate-pulse rounded-3xl bg-brand-navy/5" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-3xl bg-brand-navy/5" />
    </div>
  )
}

function AdminDashboard() {
  const { t, i18n } = useTranslation()
  const { token, user } = useAuth()
  const { disableBackgroundSync } = useSurvivalMode()
  const { syncRevision } = useSyncControl()
  const cached = readHomeCache(CACHE_KEY)
  const cachedData = isDashboard(cached.data) ? cached.data : null
  const [data, setData] = useState(cachedData)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(cachedData ? cached.lastUpdatedAt : null)
  const [loading, setLoading] = useState(!cachedData)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setError("")
    try {
      const result = await apiFetch("/admin/dashboard", { token })
      if (!isDashboard(result)) throw new Error("Unexpected dashboard payload")
      setData(result)
      setLastUpdatedAt(writeHomeCache(CACHE_KEY, result))
    } catch {
      setError(t("dashboardLoadError"))
    } finally {
      setLoading(false)
    }
  }, [token, t])

  useEffect(() => {
    if (!token || disableBackgroundSync) {
      setLoading(false)
      return
    }
    load()
  }, [token, disableBackgroundSync, syncRevision, load])

  if (loading) return <DashboardSkeleton />

  if (!data) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-brand-navy/10 bg-white/90 p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
        <p role="alert" className="mt-3 text-sm text-brand-navy/75">{error || t("dashboardOffline")}</p>
        <button type="button" className="primary-button mt-5" onClick={() => { setLoading(true); load() }}>
          {t("retry")}
        </button>
      </div>
    )
  }

  const { headcount, attendance, grades, finance, risk, actions } = data
  const fill = headcount.capacity > 0 ? headcount.enrolled / headcount.capacity : null
  const periodEnd = data.currentPeriod
    ? new Date(data.currentPeriod.endDate).toLocaleDateString(uiLocale(), { day: "2-digit", month: "long", timeZone: "UTC" })
    : null

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-brand-navy/10 bg-white/90 p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-red/70">{data.school.name ?? "EduHaiti"}</p>
          <h2 className="mt-1 font-display text-2xl text-brand-navy sm:text-3xl">
            {t("dashboardGreeting", { name: displayName(user?.name) })}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-brand-navy/65">
            {data.academicYear ? <span className="rounded-full bg-brand-navy/5 px-3 py-1 font-semibold">{data.academicYear}</span> : null}
            {data.currentPeriod ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                {t("dashboardPeriodUntil", { name: data.currentPeriod.name, date: periodEnd })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">
                <CalendarClock className="h-3 w-3" aria-hidden="true" />
                {t("dashboardNoPeriod")}
              </span>
            )}
            <span>{t("dashboardUpdated", { date: formatLastUpdated(lastUpdatedAt, i18n.language) })}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/students" className="primary-button inline-flex items-center gap-2">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {t("dashboardNewStudent")}
          </Link>
          <Link to="/admin/family-communication" className="inline-flex items-center gap-2 rounded-2xl border border-brand-navy/15 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-navy/5">
            <Mail className="h-4 w-4" aria-hidden="true" />
            {t("dashboardMessageFamilies")}
          </Link>
        </div>
      </section>

      {error ? (
        <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {error} {t("dashboardShowingCached")}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          icon={GraduationCap}
          label={t("dashboardStudents")}
          value={headcount.students}
          detail={fill == null ? t("dashboardInClasses", { count: headcount.classes }) : t("dashboardFill", { value: percent(fill), count: headcount.classes })}
        />
        <Kpi
          icon={Users}
          label={t("dashboardTeachers")}
          value={headcount.teachers}
          detail={t("dashboardDisciplines", { count: headcount.disciplines })}
        />
        <Kpi
          icon={ClipboardCheck}
          label={t("dashboardAttendance30")}
          value={percent(attendance.rate)}
          trend={<Trend current={attendance.rate} previous={attendance.previousRate} />}
          detail={t("dashboardRecords", { count: attendance.records })}
        />
        <Kpi
          icon={BookOpen}
          label={t("dashboardOverallAverage")}
          value={score(grades.average)}
          detail={grades.passRate == null ? t("dashboardNoGrades") : t("dashboardPassRate", { value: percent(grades.passRate) })}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={t("dashboardAttendanceTrend")} icon={ClipboardCheck} className="xl:col-span-2">
          <AttendanceChart weeks={attendance.weekly} />
        </Card>
        <Card title={t("dashboardToDo")} icon={ListChecks}>
          <ActionList actions={actions} />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card
          title={t("dashboardClassPerformance")}
          icon={School}
          className="xl:col-span-2"
          action={
            <Link to="/admin/classes" className="text-xs font-semibold text-brand-navy/70 hover:text-brand-navy hover:underline">
              {t("dashboardSeeAll")}
            </Link>
          }
        >
          <ClassPerformance classes={grades.classes} />
        </Card>
        <Card title={t("dashboardAtRisk")} icon={AlertTriangle}>
          <RiskList risk={risk} />
        </Card>
      </div>

      {finance ? (
        <Card
          title={t("dashboardFinance")}
          icon={HandCoins}
          action={
            <Link to="/admin/finance" className="text-xs font-semibold text-brand-navy/70 hover:text-brand-navy hover:underline">
              {t("dashboardSeeAll")}
            </Link>
          }
        >
          <FinanceSummary finance={finance} />
        </Card>
      ) : null}
    </div>
  )
}

export default AdminDashboard
