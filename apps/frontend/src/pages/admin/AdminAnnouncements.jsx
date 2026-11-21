import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { CalendarClock, CheckCircle2, Clock, Megaphone, Pencil, Plus, Trash2 } from "lucide-react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import Modal from "../../components/Modal.jsx"
import AnnouncementCard from "../../components/announcements/AnnouncementCard.jsx"
import {
  ANNOUNCEMENT_TYPES,
  TYPE_ORDER,
  announcementStatus,
  formatDateTime,
  toLocalInput,
} from "../../components/announcements/announcementMeta.js"

const TITLE_MAX = 150
const CONTENT_MAX = 5000
const STATUS_FILTERS = ["all", "live", "scheduled", "expired"]
const STATUS_STYLE = {
  live: { icon: CheckCircle2, className: "bg-emerald-100 text-emerald-800" },
  scheduled: { icon: Clock, className: "bg-sky-100 text-sky-800" },
  expired: { icon: CalendarClock, className: "bg-brand-navy/10 text-brand-navy/70" },
}

const emptyForm = { title: "", content: "", type: "GENERAL", schedule: false, publishedAt: "", expiresAt: "" }

function formFrom(item) {
  if (!item) return emptyForm
  return {
    title: item.title,
    content: item.content,
    type: item.type,
    schedule: announcementStatus(item) === "scheduled",
    publishedAt: toLocalInput(item.publishedAt),
    expiresAt: toLocalInput(item.expiresAt),
  }
}

function StatusChip({ status }) {
  const { t } = useTranslation()
  const style = STATUS_STYLE[status]
  const Icon = style.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.className}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(`announcementStatus_${status}`)}
    </span>
  )
}

function AnnouncementEditor({ item, onClose, onSaved }) {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [form, setForm] = useState(() => formFrom(item))
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))

  const validate = () => {
    if (!form.title.trim()) return t("announcementTitleRequired")
    if (!form.content.trim()) return t("announcementContentRequired")
    if (form.schedule && !form.publishedAt) return t("announcementPublishDateRequired")
    const publish = form.schedule ? new Date(form.publishedAt) : new Date()
    if (form.expiresAt && new Date(form.expiresAt) <= publish) return t("announcementExpiryAfterPublish")
    return ""
  }

  const submit = async (event) => {
    event.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    const body = {
      title: form.title.trim(),
      content: form.content.trim(),
      type: form.type,
    }
    if (form.schedule) body.publishedAt = new Date(form.publishedAt).toISOString()
    else if (item && announcementStatus(item) === "scheduled") body.publishedAt = new Date().toISOString()
    if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString()
    else if (item?.expiresAt) body.expiresAt = null

    setSaving(true)
    setError("")
    try {
      const saved = await apiFetch(item ? `/announcements/${item.id}` : "/announcements", {
        method: item ? "PUT" : "POST",
        token,
        body,
      })
      onSaved(saved, item ? "updated" : "created")
    } catch (err) {
      setError(err.message.includes("expiresAt") ? t("announcementExpiryAfterPublish") : t("announcementSaveError"))
    } finally {
      setSaving(false)
    }
  }

  const preview = {
    id: "preview",
    title: form.title.trim() || t("announcementTitlePlaceholder"),
    content: form.content.trim() || t("announcementContentPlaceholder"),
    type: form.type,
    publishedAt: form.schedule && form.publishedAt ? new Date(form.publishedAt).toISOString() : new Date().toISOString(),
  }

  const label = "text-xs font-semibold uppercase tracking-[0.15em] text-brand-navy/60"
  const input =
    "mt-1.5 w-full rounded-2xl border border-brand-navy/15 bg-white px-3 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-navy/40 focus:ring-2 focus:ring-brand-sky/30"

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={item ? t("announcementEdit") : t("announcementNew")}
      actions={
        <>
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-navy/5">
            {t("cancel")}
          </button>
          <button type="submit" form="announcement-form" className="primary-button" disabled={saving}>
            {saving ? t("loading") : form.schedule ? t("announcementSchedule") : item ? t("save") : t("announcementPublish")}
          </button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <form id="announcement-form" onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="announcement-title" className={label}>{t("announcementTitle")}</label>
              <span className="text-[11px] tabular-nums text-brand-navy/50">{form.title.length}/{TITLE_MAX}</span>
            </div>
            <input
              id="announcement-title"
              className={input}
              maxLength={TITLE_MAX}
              value={form.title}
              placeholder={t("announcementTitlePlaceholder")}
              onChange={(event) => set({ title: event.target.value })}
            />
          </div>

          <fieldset>
            <legend className={label}>{t("announcementType")}</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TYPE_ORDER.map((key) => {
                const meta = ANNOUNCEMENT_TYPES[key]
                const Icon = meta.icon
                const active = form.type === key
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border p-3 text-center text-xs font-semibold transition-colors ${
                      active ? "border-brand-navy bg-brand-navy/5 text-brand-navy" : "border-brand-navy/10 text-brand-navy/70 hover:border-brand-navy/30"
                    }`}
                  >
                    <input type="radio" name="announcement-type" value={key} checked={active} onChange={() => set({ type: key })} className="sr-only" />
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {t(meta.labelKey)}
                  </label>
                )
              })}
            </div>
            {form.type === "EMERGENCY" ? (
              <p className="mt-2 text-xs text-brand-red">{t("announcementEmergencyHint")}</p>
            ) : null}
          </fieldset>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="announcement-content" className={label}>{t("announcementContent")}</label>
              <span className="text-[11px] tabular-nums text-brand-navy/50">{form.content.length}/{CONTENT_MAX}</span>
            </div>
            <textarea
              id="announcement-content"
              rows={6}
              className={input}
              maxLength={CONTENT_MAX}
              value={form.content}
              placeholder={t("announcementContentPlaceholder")}
              onChange={(event) => set({ content: event.target.value })}
            />
          </div>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className={`${label} mb-1.5`}>{t("announcementPublication")}</legend>
            <div className="flex rounded-2xl bg-brand-navy/5 p-1 sm:col-span-2">
              {[false, true].map((schedule) => (
                <button
                  key={String(schedule)}
                  type="button"
                  aria-pressed={form.schedule === schedule}
                  onClick={() => set({ schedule })}
                  className={`flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                    form.schedule === schedule ? "bg-white text-brand-navy shadow-sm" : "text-brand-navy/60"
                  }`}
                >
                  {schedule ? t("announcementLater") : t("announcementNow")}
                </button>
              ))}
            </div>
            {form.schedule ? (
              <div>
                <label htmlFor="announcement-published" className={label}>{t("announcementPublishedAt")}</label>
                <input
                  id="announcement-published"
                  type="datetime-local"
                  className={input}
                  value={form.publishedAt}
                  onChange={(event) => set({ publishedAt: event.target.value })}
                />
              </div>
            ) : null}
            <div className={form.schedule ? "" : "sm:col-span-2"}>
              <label htmlFor="announcement-expires" className={label}>{t("announcementExpiresAt")}</label>
              <input
                id="announcement-expires"
                type="datetime-local"
                className={input}
                value={form.expiresAt}
                onChange={(event) => set({ expiresAt: event.target.value })}
              />
              <p className="mt-1 text-[11px] text-brand-navy/50">{t("announcementExpiresHint")}</p>
            </div>
          </fieldset>

          {error ? (
            <p role="alert" className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">
              {error}
            </p>
          ) : null}
        </form>

        <aside aria-label={t("announcementPreview")}>
          <p className={label}>{t("announcementPreview")}</p>
          <div className="mt-1.5">
            <AnnouncementCard announcement={preview} />
          </div>
        </aside>
      </div>
    </Modal>
  )
}

function AdminAnnouncements() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [filter, setFilter] = useState("all")
  const [editing, setEditing] = useState(null) // null | "new" | announcement
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const result = await apiFetch("/announcements?include=all", { token })
      setItems(Array.isArray(result) ? result : [])
      setError("")
    } catch {
      setError(t("announcementsLoadError"))
    } finally {
      setLoading(false)
    }
  }, [token, t])

  useEffect(() => {
    load()
  }, [load])

  const withStatus = items.map((item) => ({ item, status: announcementStatus(item) }))
  const counts = STATUS_FILTERS.reduce(
    (acc, key) => ({ ...acc, [key]: key === "all" ? withStatus.length : withStatus.filter((row) => row.status === key).length }),
    {},
  )
  const visible = filter === "all" ? withStatus : withStatus.filter((row) => row.status === filter)

  const onSaved = (_saved, action) => {
    setEditing(null)
    setNotice(t(action === "created" ? "announcementCreated" : "announcementUpdated"))
    load()
  }

  const confirmDelete = async () => {
    setBusy(true)
    try {
      await apiFetch(`/announcements/${deleting.id}`, { method: "DELETE", token })
      setNotice(t("announcementDeleted"))
      setDeleting(null)
      load()
    } catch {
      setError(t("announcementDeleteError"))
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("announcementFilterLabel")}>
          {STATUS_FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === key ? "border-brand-navy bg-brand-navy text-white" : "border-brand-navy/15 bg-white text-brand-navy hover:bg-brand-navy/5"
              }`}
            >
              {key === "all" ? t("all") : t(`announcementStatus_${key}`)} · {counts[key]}
            </button>
          ))}
        </div>
        <button type="button" className="primary-button inline-flex items-center justify-center gap-2" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("announcementNew")}
        </button>
      </div>

      {notice ? (
        <p role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-32 animate-pulse rounded-2xl bg-brand-navy/5" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-brand-navy/15 bg-white/70 p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-brand-navy/30" aria-hidden="true" />
          <p className="mt-3 text-sm text-brand-navy/60">{items.length === 0 ? t("announcementsAdminEmpty") : t("announcementsEmpty")}</p>
          {items.length === 0 ? (
            <button type="button" className="primary-button mt-4" onClick={() => setEditing("new")}>
              {t("announcementFirst")}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map(({ item, status }) => (
            <AnnouncementCard key={item.id} announcement={item}>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-brand-navy/5 pt-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-brand-navy/55">
                  <StatusChip status={status} />
                  {status === "scheduled" ? <span>{t("announcementScheduledFor", { date: formatDateTime(item.publishedAt) })}</span> : null}
                  {item.expiresAt && status !== "expired" ? <span>{t("announcementExpiresOn", { date: formatDateTime(item.expiresAt) })}</span> : null}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(item)}
                    className="rounded-lg p-2 text-brand-navy/60 hover:bg-brand-navy/5 hover:text-brand-navy"
                    aria-label={t("announcementEditNamed", { title: item.title })}
                    title={t("announcementEdit")}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(item)}
                    className="rounded-lg p-2 text-brand-navy/60 hover:bg-brand-red/10 hover:text-brand-red"
                    aria-label={t("announcementDeleteNamed", { title: item.title })}
                    title={t("delete")}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </AnnouncementCard>
          ))}
        </div>
      )}

      {editing ? (
        <AnnouncementEditor item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={onSaved} />
      ) : null}

      {deleting ? (
        <Modal
          isOpen
          size="sm"
          onClose={() => setDeleting(null)}
          title={t("announcementDeleteTitle")}
          actions={
            <>
              <button type="button" onClick={() => setDeleting(null)} className="rounded-2xl px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-navy/5">
                {t("cancel")}
              </button>
              <button type="button" onClick={confirmDelete} disabled={busy} className="rounded-2xl bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red/90 disabled:opacity-60">
                {busy ? t("loading") : t("delete")}
              </button>
            </>
          }
        >
          <p className="text-sm text-brand-navy/75">{t("announcementDeleteText", { title: deleting.title })}</p>
        </Modal>
      ) : null}
    </div>
  )
}

export default AdminAnnouncements
