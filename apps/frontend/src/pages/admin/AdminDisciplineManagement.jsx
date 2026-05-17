import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { sanitizeText } from "../../lib/string.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import LoadMoreList from "../../components/LoadMoreList.jsx"
import ListItemCard from "../../components/ListItemCard.jsx"
import { BookOpen } from "lucide-react"
import AdminSectionToolbar from "../../components/AdminSectionToolbar.jsx"

const initialForm = {
  name: "",
  code: "",
  credits: 0,
}

function AdminDisciplineManagement() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [series, setSeries] = useState([])
  const [selectedSeriesId, setSelectedSeriesId] = useState("")
  const [disciplines, setDisciplines] = useState([])
  const [form, setForm] = useState(initialForm)
  const [activeSection, setActiveSection] = useState("list")
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadSeries = async () => {
    try {
      const data = await apiFetch("/admin/classes/meta/series", { token })
      setSeries(data ?? [])
    } catch (err) {
      setError(err.message)
    }
  }

  const loadDisciplines = async (seriesId) => {
    if (!seriesId.trim()) {
      setDisciplines([])
      return
    }

    setLoading(true)
    setError("")
    try {
      const data = await apiFetch(`/admin/disciplines?seriesId=${encodeURIComponent(seriesId)}`, {
        token,
      })
      setDisciplines(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      loadSeries()
    }
  }, [token])

  const handleSeriesChange = (seriesId) => {
    setSelectedSeriesId(seriesId)
    setForm(initialForm)
    setEditingId(null)
    loadDisciplines(seriesId)
  }

  const submitForm = async (event) => {
    event.preventDefault()
    if (!selectedSeriesId.trim()) {
      setError(t("adminSelectSeriesRequired"))
      return
    }

    setLoading(true)
    setError("")
    setMessage("")

    try {
      if (editingId) {
        await apiFetch(`/admin/disciplines/${editingId}`, {
          method: "PUT",
          token,
          body: {
            name: form.name,
            code: form.code,
            credits: Number(form.credits),
          },
        })
        setMessage(t("adminDisciplineUpdated"))
      } else {
        await apiFetch("/admin/disciplines", {
          method: "POST",
          token,
          body: {
            seriesId: selectedSeriesId,
            name: form.name,
            code: form.code,
            credits: Number(form.credits),
          },
        })
        setMessage(t("adminDisciplineCreated"))
      }

      setForm(initialForm)
      setEditingId(null)
      await loadDisciplines(selectedSeriesId)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (discipline) => {
    setEditingId(discipline.id)
    setForm({
      name: discipline.name,
      code: discipline.code || "",
      credits: discipline.credits || 0,
    })
  }

  const deleteDiscipline = async (disciplineId) => {
    if (!window.confirm(t("adminConfirmDelete"))) {
      return
    }

    setLoading(true)
    setError("")
    setMessage("")

    try {
      await apiFetch(`/admin/disciplines/${disciplineId}`, {
        method: "DELETE",
        token,
      })
      setMessage(t("adminDisciplineDeleted"))
      await loadDisciplines(selectedSeriesId)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("adminDisciplineManagementTitle")}
        subtitle={t("adminDisciplineManagementSubtitle")}
      />

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand-navy">{t("adminSelectSeries")}</h3>
          <AdminSectionToolbar
            sections={[{ key: "list", label: t("list") }, { key: "filters", label: t("filters") }, { key: "create", label: t("create") }]}
            active={activeSection}
            onChange={(k) => setActiveSection(k)}
          />
        </div>
        {activeSection !== "list" && (
          <select
            value={selectedSeriesId}
            onChange={(event) => handleSeriesChange(event.target.value)}
            className="mt-3 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          >
            <option value="">{t("adminSelectSeriesOption")}</option>
            {series.map((ser) => (
              <option key={ser.id} value={ser.id}>
                {sanitizeText(ser.name)} ({ser.academicYear?.year})
              </option>
            ))}
          </select>
        )}
      </section>

      {selectedSeriesId && (
        <>
          <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
            <h3 className="text-base font-semibold text-brand-navy">
              {editingId ? t("adminEditDiscipline") : t("adminCreateDiscipline")}
            </h3>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={submitForm}>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-2"
                placeholder={t("adminDisciplineName")}
                required
              />

              <input
                value={form.code}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                placeholder={t("adminDisciplineCode")}
              />

              <input
                type="number"
                min="0"
                value={form.credits}
                onChange={(event) => setForm((prev) => ({ ...prev, credits: Number(event.target.value) }))}
                className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                placeholder={t("adminDisciplineCredits")}
              />

              <div className="flex gap-2 md:col-span-2">
                <button className="primary-button flex-1" type="submit" disabled={loading}>
                  {editingId ? t("adminUpdate") : t("adminCreate")}
                </button>
                {editingId && (
                  <button
                    className="outline-button"
                    type="button"
                    onClick={() => {
                      setEditingId(null)
                      setForm(initialForm)
                    }}
                  >
                    {t("adminCancel")}
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
            <h3 className="text-base font-semibold text-brand-navy">{t("adminDisciplineList")}</h3>

            <div className="mt-4 space-y-3">
              {loading && !disciplines.length ? (
                <p className="text-sm text-brand-navy/60">{t("loading")}</p>
              ) : disciplines.length === 0 ? (
                <p className="text-sm text-brand-navy/60">{t("noData")}</p>
              ) : (
                <LoadMoreList
                  items={disciplines}
                  initialLimit={6}
                  step={6}
                  renderItem={(discipline) => (
                    <ListItemCard
                      id={discipline.id}
                      icon={<BookOpen className="h-5 w-5 text-brand-red" />}
                      title={sanitizeText(discipline.name)}
                      subtitle={discipline.code || t("adminDisciplineCode")}
                      preview={
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          <div>
                            <p className="text-xs text-brand-navy/60">{t("adminDisciplineCode")}</p>
                            <p className="font-semibold text-brand-navy">{sanitizeText(discipline.code) || "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-brand-navy/60">{t("adminDisciplineCredits")}</p>
                            <p className="font-semibold text-brand-navy">{discipline.credits}</p>
                          </div>
                          <div>
                            <p className="text-xs text-brand-navy/60">{t("adminSelectSeries")}</p>
                            <p className="font-semibold text-brand-navy">{sanitizeText(discipline.series?.name) || "-"}</p>
                          </div>
                        </div>
                      }
                      onEdit={() => startEdit(discipline)}
                      onDelete={() => deleteDiscipline(discipline.id)}
                    />
                  )}
                />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default AdminDisciplineManagement
