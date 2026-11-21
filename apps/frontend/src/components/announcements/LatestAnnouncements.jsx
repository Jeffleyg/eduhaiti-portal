import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Megaphone } from "lucide-react"
import { useAuth } from "../../context/AuthContext.jsx"
import { useSurvivalMode } from "../../context/useSurvivalMode.js"
import { apiFetch } from "../../lib/api.js"
import AnnouncementCard from "./AnnouncementCard.jsx"

/** Dashboard widget: the 3 latest announcements in effect, with a link to all. */
function LatestAnnouncements({ to }) {
  const { t } = useTranslation()
  const { token } = useAuth()
  const { disableBackgroundSync } = useSurvivalMode()
  const [items, setItems] = useState(null)

  useEffect(() => {
    if (!token || disableBackgroundSync) return
    apiFetch("/announcements/latest?limit=3", { token })
      .then((result) => setItems(Array.isArray(result) ? result : []))
      .catch(() => setItems([]))
  }, [token, disableBackgroundSync])

  // Nothing to show (or still loading): keep the dashboard uncluttered.
  if (!items || items.length === 0) return null

  return (
    <section className="rounded-3xl border border-brand-navy/10 bg-white/90 p-5 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-brand-navy">
          <Megaphone className="h-4 w-4 text-brand-navy/60" aria-hidden="true" />
          {t("navAnnouncements")}
        </h2>
        <Link to={to} className="text-xs font-semibold text-brand-navy/70 hover:text-brand-navy hover:underline">
          {t("dashboardSeeAll")}
        </Link>
      </header>
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <AnnouncementCard key={item.id} announcement={item} compact />
        ))}
      </div>
    </section>
  )
}

export default LatestAnnouncements
