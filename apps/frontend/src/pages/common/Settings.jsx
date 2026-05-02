import { useState } from "react"
import { useTranslation } from "react-i18next"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useNavigate } from "react-router-dom"

export default function Settings() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [language, setLanguage] = useState(i18n.language || "en")
  const [syncMode, setSyncMode] = useState("LWW")
  const [notifications, setNotifications] = useState(true)
  const [saving, setSaving] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    // For now just simulate save and change language locally
    try {
      i18n.changeLanguage(language)
      // TODO: call backend to persist settings
      setTimeout(() => {
        setSaving(false)
        navigate(-1)
      }, 500)
    } catch (err) {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-sand">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
          <div className="mb-6 flex items-center justify-between">
            <SectionHeader title={t("settings")} subtitle={t("settingsSubtitle") || ""} />
          </div>

          <form onSubmit={save} className="space-y-6">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">{t("selectLanguage")}</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm">
                <option value="fr">fr</option>
                <option value="ht">ht</option>
                <option value="pt">pt</option>
                <option value="en">en</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">{t("syncMode")}</label>
              <select value={syncMode} onChange={(e) => setSyncMode(e.target.value)} className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm">
                <option value="LWW">{t("syncStrategyLWW")}</option>
                <option value="MANUAL">{t("syncStrategyManual")}</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">{t("notifications")}</p>
                <p className="mt-1 text-sm text-brand-navy/60">{t("notificationsSubtitle")}</p>
              </div>
              <div>
                <label className="switch">
                  <input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />
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
