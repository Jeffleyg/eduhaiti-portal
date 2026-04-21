import { Globe, ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { useSurvivalMode } from "../context/useSurvivalMode.js"
import { useSyncControl } from "../context/useSyncControl.js"
import { formatLastUpdated } from "../offline/sqliteCache"

function TopBar({ role }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const currentLanguage = i18n.resolvedLanguage || i18n.language
  const nextLanguage = currentLanguage === "fr" ? "ht" : "fr"
  const { isSurvivalMode, isLowBattery, is2G } = useSurvivalMode()
  const { isSyncing, completedTasks, totalTasks, currentTask, lastRunAt, syncNow, error, syncHistory } = useSyncControl()

  const syncLabel = isSyncing
    ? t("syncProgress", {
        done: completedTasks,
        total: totalTasks,
      })
    : t("syncNow")

  const survivalReason = isLowBattery ? t("lowBattery") : is2G ? t("slowNetwork") : ""

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white/80 px-5 py-4 shadow-lg shadow-brand-navy/5">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 rounded-lg p-2 text-brand-navy/70 hover:bg-brand-navy/10 transition-colors"
          type="button"
          title={t("back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red/60">
            {t("dashboardTitle")}
          </p>
          <h1 className="text-2xl font-semibold text-brand-navy">{t("role" + role)}</h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isSurvivalMode ? (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            {t("survivalMode")}: {survivalReason}
          </span>
        ) : null}

        <button
          className="inline-flex items-center gap-2 rounded-full border border-brand-sky/30 bg-brand-sky/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-brand-navy disabled:opacity-60"
          type="button"
          onClick={() => syncNow(role)}
          disabled={isSyncing}
          title={currentTask ? `${t("syncingTask")}: ${currentTask}` : t("syncNow")}
        >
          {syncLabel}
        </button>

        <button
          className="inline-flex items-center gap-2 rounded-full border border-brand-navy/20 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy"
          type="button"
          onClick={() => i18n.changeLanguage(nextLanguage)}
        >
          <Globe className="h-4 w-4" />
          {t("languageSwitch")}
        </button>

        <span className="w-full text-right text-xs text-brand-navy/60">
          {t("lastSyncAt")} {formatLastUpdated(lastRunAt, currentLanguage)}
        </span>
        {error ? <span className="w-full text-right text-xs text-brand-red">{error}</span> : null}
        {syncHistory.length > 0 ? (
          <div className="w-full rounded-xl border border-brand-navy/10 bg-sand px-3 py-2 text-xs text-brand-navy/70">
            <p className="font-semibold text-brand-navy/80">{t("syncHistory")}</p>
            {syncHistory.slice(0, 3).map((item) => (
              <p key={item.id}>
                {formatLastUpdated(item.createdAt, currentLanguage)} • {item.completedTasks}/{item.totalTasks} • {t(item.status === "success" ? "syncSuccess" : "syncFailed")}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default TopBar
