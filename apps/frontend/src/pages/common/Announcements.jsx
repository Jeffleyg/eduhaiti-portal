import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Megaphone } from "lucide-react"
import { useAuth } from "../../context/AuthContext.jsx"
import { useSurvivalMode } from "../../context/useSurvivalMode.js"
import { useSyncControl } from "../../context/useSyncControl.js"
import { apiFetch } from "../../lib/api.js"
import { readHomeCache, writeHomeCache } from "../../offline/sqliteCache"
import AnnouncementCard from "../../components/announcements/AnnouncementCard.jsx"
import { TYPE_ORDER, typeMeta } from "../../components/announcements/announcementMeta.js"

const CACHE_KEY = "announcementsFeed"

/** School announcements for teachers and students (only the ones in effect). */
function Announcements() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const { disableBackgroundSync } = useSurvivalMode()
  const { syncRevision } = useSyncControl()
  const cached = readHomeCache(CACHE_KEY).data
  const [items, setItems] = useState(Array.isArray(cached) ? cached : [])
  const canFetch = Boolean(token) && !disableBackgroundSync
  const [loading, setLoading] = useState(!Array.isArray(cached) && canFetch)
  const [error, setError] = useState("")
  const [type, setType] = useState("ALL")

  useEffect(() => {
    if (!canFetch) return
    apiFetch("/announcements", { token })
      .then((result) => {
        const list = Array.isArray(result) ? result : []
        setItems(list)
        setError("")
        writeHomeCache(CACHE_KEY, list)
      })
      .catch(() => setError(t("announcementsLoadError")))
      .finally(() => setLoading(false))
  }, [canFetch, token, syncRevision, t])

  const visible = type === "ALL" ? items : items.filter((item) => item.type === type)
  const filters = ["ALL", ...TYPE_ORDER.filter((key) => items.some((item) => item.type === key))]

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {filters.length > 2 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("announcementFilterLabel")}>
          {filters.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              aria-pressed={type === key}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                type === key
                  ? "border-brand-navy bg-brand-navy text-white"
                  : "border-brand-navy/15 bg-white text-brand-navy hover:bg-brand-navy/5"
              }`}
            >
              {key === "ALL" ? t("all") : t(typeMeta(key).labelKey)}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-28 animate-pulse rounded-2xl bg-brand-navy/5" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-brand-navy/15 bg-white/70 p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-brand-navy/30" aria-hidden="true" />
          <p className="mt-3 text-sm text-brand-navy/60">{t("announcementsEmpty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <AnnouncementCard key={item.id} announcement={item} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Announcements
