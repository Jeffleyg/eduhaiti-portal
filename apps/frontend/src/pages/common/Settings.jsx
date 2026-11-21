import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useSyncControl } from "../../context/useSyncControl.js"
import { formatLastUpdated } from "../../offline/sqliteCache"

const NOTIFICATIONS_KEY = "eduhaiti.settings.notifications"

const LANGUAGE_OPTIONS = [
  { value: "fr", label: "Français" },
  { value: "ht", label: "Kreyòl Ayisyen" },
  { value: "pt", label: "Português" },
  { value: "en", label: "English" },
]

function readNotificationsPreference() {
  try {
    return localStorage.getItem(NOTIFICATIONS_KEY) !== "false"
  } catch {
    return true
  }
}

function writeNotificationsPreference(value) {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, value ? "true" : "false")
  } catch {
    // storage unavailable (private mode) - preference stays for this session only
  }
}

export default function Settings() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { conflictStrategy, setConflictStrategy, syncHistory = [] } = useSyncControl()

  const currentLanguage = (i18n.resolvedLanguage || i18n.language || "fr").slice(0, 2)
  const [language, setLanguage] = useState(currentLanguage)
  const [syncMode, setSyncMode] = useState(conflictStrategy ?? "lww")
  const [notifications, setNotifications] = useState(readNotificationsPreference)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      try {
        await i18n.changeLanguage(language)
      } catch {
        // The language detector may fail to persist (blocked storage);
        // keep saving the other preferences.
      }
      setConflictStrategy(syncMode)
      writeNotificationsPreference(notifications)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
          <div className="mb-6 flex items-center justify-between">
            <SectionHeader title={t("settings")} subtitle={t("settingsSubtitle") || ""} />
          </div>

          {saved ? (
            <p className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
              {t("settingsSaved")}
            </p>
          ) : null}

          <form onSubmit={save} className="space-y-6">
            <div>
              <label htmlFor="settings-language" className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">{t("selectLanguage")}</label>
              <select id="settings-language" value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm">
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="settings-sync" className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">{t("syncMode")}</label>
              <select id="settings-sync" value={syncMode} onChange={(e) => setSyncMode(e.target.value)} className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm">
                <option value="lww">{t("syncStrategyLWW")}</option>
                <option value="manual">{t("syncStrategyManual")}</option>
              </select>
              <p className="mt-1 text-xs text-brand-navy/60">{t("syncModeHelp")}</p>
            </div>

            {syncHistory.length > 0 ? (
              <section aria-labelledby="settings-sync-history" className="rounded-2xl border border-brand-navy/10 bg-sand px-4 py-3 text-sm text-brand-navy/85">
                <h3 id="settings-sync-history" className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">{t("syncHistory")}</h3>
                <ul className="mt-2 space-y-1">
                  {syncHistory.slice(0, 5).map((item) => (
                    <li key={item.id} className="flex flex-wrap justify-between gap-2">
                      <span>{formatLastUpdated(item.createdAt, i18n.resolvedLanguage || i18n.language)}</span>
                      <span>
                        {item.completedTasks}/{item.totalTasks} •{" "}
                        <span className={item.status === "success" ? "text-emerald-700" : "text-brand-red"}>
                          {t(item.status === "success" ? "syncSuccess" : "syncFailed")}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">{t("notifications")}</p>
                <p className="mt-1 text-sm text-brand-navy/60">{t("notificationsSubtitle")}</p>
              </div>
              <div>
                <label className="switch">
                  <input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} aria-label={t("notifications")} />
                  <span className="slider" />
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => navigate(-1)} className="rounded-xl border border-brand-navy/20 bg-white/80 px-6 py-2.5 text-sm font-semibold text-brand-navy">
                {t("cancel")}
              </button>
              <button type="submit" className="rounded-xl bg-gradient-to-r from-brand-navy to-brand-navy/80 px-6 py-2.5 text-sm font-bold text-white" disabled={saving}>
                {saving ? t("loading") : t("save")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
