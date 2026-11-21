import { CalendarDays, GraduationCap, Megaphone, Siren } from "lucide-react"
import { uiLocale } from "../../lib/locale.js"

/** Visual identity per type: an icon and a label always come with the color. */
export const ANNOUNCEMENT_TYPES = {
  GENERAL: { icon: Megaphone, labelKey: "announcementTypeGENERAL", badge: "bg-brand-navy/10 text-brand-navy" },
  ACADEMIC: { icon: GraduationCap, labelKey: "announcementTypeACADEMIC", badge: "bg-sky-100 text-sky-800" },
  EVENT: { icon: CalendarDays, labelKey: "announcementTypeEVENT", badge: "bg-emerald-100 text-emerald-800" },
  EMERGENCY: { icon: Siren, labelKey: "announcementTypeEMERGENCY", badge: "bg-brand-red/10 text-brand-red" },
}

export const TYPE_ORDER = ["GENERAL", "ACADEMIC", "EVENT", "EMERGENCY"]

export const typeMeta = (type) => ANNOUNCEMENT_TYPES[type] ?? ANNOUNCEMENT_TYPES.GENERAL

/** "live" | "scheduled" | "expired" at time `now`. */
export function announcementStatus(item, now = Date.now()) {
  if (new Date(item.publishedAt).getTime() > now) return "scheduled"
  if (item.expiresAt && new Date(item.expiresAt).getTime() <= now) return "expired"
  return "live"
}

const UNITS = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
]

/** "il y a 2 jours" / "dans 3 heures", in the UI language. */
export function relativeTime(iso, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const format = new Intl.RelativeTimeFormat(uiLocale(), { numeric: "auto" })
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit)
  }
  return format.format(0, "minute")
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString(uiLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** ISO -> value for <input type="datetime-local"> in the user's time zone. */
export function toLocalInput(iso) {
  if (!iso) return ""
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
