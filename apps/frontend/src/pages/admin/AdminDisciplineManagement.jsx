import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"

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
        <h3 className="text-base font-semibold text-brand-navy">{t("adminSelectSeries")}</h3>
        <select
          value={selectedSeriesId}
          onChange={(event) => handleSeriesChange(event.target.value)}
          className="mt-3 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
        >
          <option value="">{t("adminSelectSeriesOption")}</option>
          {series.map((ser) => (
            <option key={ser.id} value={ser.id}>
              {ser.name} ({ser.academicYear?.year})
            </option>
          ))}
        </select>
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
                disciplines.map((discipline) => (
                  <div
                    key={discipline.id}
                    className="flex flex-col gap-3 rounded-2xl border border-brand-navy/10 bg-white p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-brand-navy">{discipline.name}</p>
                      <p className="text-xs text-brand-navy/60">
                        {discipline.code && `${t("adminDisciplineCode")}: ${discipline.code} | `}
                        {t("adminDisciplineCredits")}: {discipline.credits}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="outline-button"
                        onClick={() => startEdit(discipline)}
                        disabled={loading}
                      >
                        {t("adminEdit")}
                      </button>
                      <button
                        className="outline-button"
                        onClick={() => deleteDiscipline(discipline.id)}
                        disabled={loading}
                      >
                        {t("adminDelete")}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default AdminDisciplineManagement
