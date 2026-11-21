import { useState } from "react"
import { useTranslation } from "react-i18next"
import { displayName } from "../../lib/string.js"
import { formatDateTime, relativeTime, typeMeta } from "./announcementMeta.js"

const LONG_TEXT = 280

export function TypeBadge({ type }) {
  const { t } = useTranslation()
  const meta = typeMeta(type)
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(meta.labelKey)}
    </span>
  )
}

/** One announcement as readers see it. `compact` is used in dashboard widgets. */
function AnnouncementCard({ announcement, compact = false, children }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const content = announcement.content ?? ""
  const isLong = content.length > (compact ? 140 : LONG_TEXT)
  const shown = isLong && !expanded ? `${content.slice(0, compact ? 140 : LONG_TEXT).trimEnd()}…` : content
  const emergency = announcement.type === "EMERGENCY"

  return (
    <article
      className={`rounded-2xl border p-4 ${emergency ? "border-brand-red/30 bg-brand-red/5" : "border-brand-navy/10 bg-white"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TypeBadge type={announcement.type} />
        <time
          dateTime={announcement.publishedAt}
          title={formatDateTime(announcement.publishedAt)}
          className="text-xs text-brand-navy/55"
        >
          {relativeTime(announcement.publishedAt)}
        </time>
      </div>
      <h3 className={`mt-2 font-semibold text-brand-navy ${compact ? "text-sm" : "text-base"}`}>{announcement.title}</h3>
      <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-brand-navy/75">{shown}</p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-1 text-xs font-semibold text-brand-navy/70 hover:text-brand-navy hover:underline"
        >
          {expanded ? t("showLess") : t("readMore")}
        </button>
      ) : null}
      {!compact && announcement.createdBy?.name ? (
        <p className="mt-3 text-xs text-brand-navy/50">{t("announcementBy", { name: displayName(announcement.createdBy.name) })}</p>
      ) : null}
      {children}
    </article>
  )
}

export default AnnouncementCard
