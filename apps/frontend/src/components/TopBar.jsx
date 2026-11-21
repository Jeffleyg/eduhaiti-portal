import { AlertTriangle, ArrowLeft, BatteryLow, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router-dom"
import { useSurvivalMode } from "../context/useSurvivalMode.js"
import { useSyncControl } from "../context/useSyncControl.js"
import { formatLastUpdated } from "../offline/sqliteCache"
import LanguageSelector from "./LanguageSelector"
import { findNavItem, roleLabelKey } from "./navigation.js"

/**
 * Page header shown above every authenticated page: the title of the current
 * page, the user's role, and the compact offline-sync / language controls.
 * The sync strategy and history live in Settings.
 */
function TopBar({ role }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const currentLanguage = i18n.resolvedLanguage || i18n.language
  const { isSurvivalMode, isLowBattery, is2G } = useSurvivalMode()
  const { isSyncing, completedTasks, totalTasks, currentTask, lastRunAt, syncNow, error, lastSyncConflicts } =
    useSyncControl()

  const navItem = findNavItem(role, location.pathname)
  const pageTitle = navItem ? t(navItem.labelKey) : t("dashboardTitle")
  const PageIcon = navItem?.icon

  const syncLabel = isSyncing ? t("syncProgress", { done: completedTasks, total: totalTasks }) : t("syncNow")
  const survivalReason = isLowBattery ? t("lowBattery") : is2G ? t("slowNetwork") : ""

  return (
    <header className="surface-panel flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-brand-navy/85 transition-colors hover:bg-brand-navy/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
            type="button"
            title={t("back")}
            aria-label={t("back")}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          {PageIcon ? (
            <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-navy/5 text-brand-navy sm:flex">
              <PageIcon className="h-5 w-5" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-red/70">{t(roleLabelKey(role))}</p>
            <h1 className="truncate font-display text-2xl font-semibold text-brand-navy sm:text-3xl">{pageTitle}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSurvivalMode ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              <BatteryLow className="h-3.5 w-3.5" aria-hidden="true" />
              {t("survivalMode")}: {survivalReason}
            </span>
          ) : null}
          <button
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-brand-sky/20 bg-brand-sky/10 px-3.5 py-1.5 text-sm font-medium text-brand-navy transition-colors hover:bg-brand-sky/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky disabled:opacity-60"
            type="button"
            onClick={() => syncNow(role)}
            disabled={isSyncing}
            title={`${currentTask ? `${t("syncingTask")}: ${currentTask}` : t("syncNow")} — ${t("lastSyncAt")} ${formatLastUpdated(lastRunAt, currentLanguage)}`}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>{syncLabel}</span>
          </button>
          <LanguageSelector />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-navy/70">
        <span>
          <span className="font-semibold text-brand-navy/80">{t("lastSyncAt")}</span>{" "}
          {formatLastUpdated(lastRunAt, currentLanguage)}
        </span>
        {error ? (
          <span className="inline-flex items-center gap-1 text-brand-red" role="alert">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {error}
          </span>
        ) : null}
        {lastSyncConflicts.length > 0 ? (
          <span className="text-amber-700">{t("syncConflictsDetected", { count: lastSyncConflicts.length })}</span>
        ) : null}
      </div>
    </header>
  )
}

export default TopBar
