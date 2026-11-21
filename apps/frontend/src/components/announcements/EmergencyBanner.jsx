import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Siren, X } from "lucide-react"
import { useAuth } from "../../context/AuthContext.jsx"
import { useSurvivalMode } from "../../context/useSurvivalMode.js"
import { apiFetch } from "../../lib/api.js"

const DISMISSED_KEY = "eduhaiti_dismissed_alerts"

function readDismissed() {
  try {
    const value = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]")
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

/**
 * Shows the latest emergency announcement in effect on every page, until the
 * user dismisses it (remembered per announcement on this device).
 */
function EmergencyBanner({ to }) {
  const { t } = useTranslation()
  const { token } = useAuth()
  const { disableBackgroundSync } = useSurvivalMode()
  const [alerts, setAlerts] = useState([])
  const [dismissed, setDismissed] = useState(readDismissed)

  useEffect(() => {
    if (!token || disableBackgroundSync) return
    apiFetch("/announcements?type=EMERGENCY", { token })
      .then((result) => setAlerts(Array.isArray(result) ? result : []))
      .catch(() => setAlerts([]))
  }, [token, disableBackgroundSync])

  const alert = alerts.find((item) => !dismissed.includes(item.id))
  if (!alert) return null

  const dismiss = () => {
    // Keep the list short: only ids of alerts that still exist.
    const next = [...dismissed.filter((id) => alerts.some((item) => item.id === id)), alert.id]
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
    setDismissed(next)
  }

  return (
    <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-brand-red/30 bg-brand-red/10 p-4 text-brand-navy">
      <Siren className="mt-0.5 h-5 w-5 shrink-0 text-brand-red" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-brand-red">{t("announcementTypeEMERGENCY")}</p>
        <p className="mt-0.5 font-semibold">{alert.title}</p>
        <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-brand-navy/75">{alert.content}</p>
        {to ? (
          <Link to={to} className="mt-1 inline-block text-xs font-semibold text-brand-navy underline">
            {t("readMore")}
          </Link>
        ) : null}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="rounded-lg p-1 text-brand-navy/60 hover:bg-white/60 hover:text-brand-navy"
        aria-label={t("dismissAlert")}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export default EmergencyBanner
