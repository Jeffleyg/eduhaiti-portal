import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"

const initialForm = {
  name: "",
  level: "",
  teacherId: "",
  maxStudents: 30,
}

function AdminClassManagement() {
  const { t } = useTranslation()
  const { token } = useAuth()

  const [years, setYears] = useState([])
  const [series, setSeries] = useState([])
  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])

  const [selectedYearId, setSelectedYearId] = useState("")
  const [selectedSeriesId, setSelectedSeriesId] = useState("")
  const [form, setForm] = useState(initialForm)
  const [editingClassId, setEditingClassId] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const availableSeries = useMemo(() => {
    if (!selectedYearId) return series
    return series.filter((item) => item.academicYearId === selectedYearId)
  }, [series, selectedYearId])

  const loadStaticData = async () => {
    const [yearsData, seriesData, teachersData] = await Promise.all([
      apiFetch("/admin/classes/meta/academic-years", { token }),
      apiFetch("/admin/classes/meta/series", { token }),
      apiFetch("/admin/users/teachers", { token }),
    ])

    setYears(yearsData ?? [])
    setSeries(seriesData ?? [])
    setTeachers(teachersData ?? [])

    const defaultYearId = yearsData?.find((item) => item.isActive)?.id ?? yearsData?.[0]?.id ?? ""
    setSelectedYearId(defaultYearId)
  }

  const loadClasses = async (yearId, seriesId) => {
    const params = new URLSearchParams()
    if (yearId) params.set("academicYearId", yearId)
    if (seriesId) params.set("seriesId", seriesId)

    const suffix = params.toString() ? `?${params.toString()}` : ""
    const data = await apiFetch(`/admin/classes${suffix}`, { token })
    setClasses(data ?? [])
  }

  useEffect(() => {
    if (!token) return

    const bootstrap = async () => {
      setLoading(true)
      setError("")
      try {
        await loadStaticData()
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    bootstrap()
  }, [token])

  useEffect(() => {
    if (!token) return
    if (!selectedYearId) {
      setClasses([])
      return
    }

    const run = async () => {
      setLoading(true)
      setError("")
      try {
        await loadClasses(selectedYearId, selectedSeriesId)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [token, selectedYearId, selectedSeriesId])

  const resetForm = () => {
    setEditingClassId("")
    setForm(initialForm)
  }

  const submitClass = async (event) => {
    event.preventDefault()

    if (!selectedYearId || !selectedSeriesId) {
      setError(t("adminClassYearSeriesRequired"))
      return
    }

    setLoading(true)
    setError("")
    setMessage("")

    try {
      if (editingClassId) {
        await apiFetch(`/admin/classes/${editingClassId}`, {
          method: "PUT",
          token,
          body: {
            name: form.name,
            teacherId: form.teacherId || null,
            maxStudents: Number(form.maxStudents),
          },
        })
        setMessage(t("adminClassUpdated"))
      } else {
        await apiFetch("/admin/classes", {
          method: "POST",
          token,
          body: {
            name: form.name,
            level: form.level || undefined,
            academicYearId: selectedYearId,
            seriesId: selectedSeriesId,
            teacherId: form.teacherId || undefined,
            maxStudents: Number(form.maxStudents),
          },
        })
        setMessage(t("adminClassCreated"))
      }

      resetForm()
      await loadClasses(selectedYearId, selectedSeriesId)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (classItem) => {
    setEditingClassId(classItem.id)
    setForm({
      name: classItem.name,
      level: classItem.level ?? "",
      teacherId: classItem.teacher?.id ?? "",
      maxStudents: classItem.maxStudents ?? 30,
    })
  }

  const deleteClass = async (classId) => {
    if (!window.confirm(t("adminConfirmDelete"))) return

    setLoading(true)
    setError("")
    setMessage("")
    try {
      await apiFetch(`/admin/classes/${classId}`, { method: "DELETE", token })
      setMessage(t("adminClassDeleted"))
      if (editingClassId === classId) {
        resetForm()
      }
      await loadClasses(selectedYearId, selectedSeriesId)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title={t("adminClassManagementTitle")} subtitle={t("adminClassManagementSubtitle")} />

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h3 className="text-base font-semibold text-brand-navy">{t("adminClassFilters")}</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select
            value={selectedYearId}
            onChange={(event) => {
              setSelectedYearId(event.target.value)
              setSelectedSeriesId("")
            }}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          >
            <option value="">{t("adminSelectAcademicYear")}</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}
              </option>
            ))}
          </select>

          <select
            value={selectedSeriesId}
            onChange={(event) => setSelectedSeriesId(event.target.value)}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          >
            <option value="">{t("adminAllSeries")}</option>
            {availableSeries.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h3 className="text-base font-semibold text-brand-navy">
          {editingClassId ? t("adminEditClass") : t("adminCreateClass")}
        </h3>

        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={submitClass}>
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            placeholder={t("adminClassName")}
            required
          />

          <input
            value={form.level}
            onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            placeholder={t("adminClassLevel")}
          />

          <select
            value={form.teacherId}
            onChange={(event) => setForm((prev) => ({ ...prev, teacherId: event.target.value }))}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          >
            <option value="">{t("adminNoTeacher")}</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name ?? teacher.email}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="1"
            value={form.maxStudents}
            onChange={(event) => setForm((prev) => ({ ...prev, maxStudents: Number(event.target.value) }))}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            placeholder={t("adminMaxStudents")}
          />

          <div className="flex gap-2 md:col-span-2">
            <button className="primary-button flex-1" type="submit" disabled={loading}>
              {editingClassId ? t("adminUpdate") : t("adminCreate")}
            </button>
            {editingClassId ? (
              <button className="outline-button" type="button" onClick={resetForm}>
                {t("adminCancel")}
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h3 className="text-base font-semibold text-brand-navy">{t("adminClassList")}</h3>

        <div className="mt-4 space-y-3">
          {loading && classes.length === 0 ? (
            <p className="text-sm text-brand-navy/60">{t("loading")}</p>
          ) : classes.length === 0 ? (
            <p className="text-sm text-brand-navy/60">{t("noData")}</p>
          ) : (
            classes.map((classItem) => (
              <div
                key={classItem.id}
                className="flex flex-col gap-3 rounded-2xl border border-brand-navy/10 bg-white p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-brand-navy">{classItem.name}</p>
                  <p className="text-xs text-brand-navy/60">
                    {classItem.level} • {classItem.series?.name} • {classItem.academicYear?.year}
                  </p>
                  <p className="text-xs text-brand-navy/60">
                    {t("teacher")}: {classItem.teacher?.name ?? t("adminNoTeacher")} • {t("students")}: {classItem.students?.length ?? 0}/{classItem.maxStudents}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button className="outline-button" onClick={() => startEdit(classItem)} disabled={loading}>
                    {t("adminEdit")}
                  </button>
                  <button className="outline-button" onClick={() => deleteClass(classItem.id)} disabled={loading}>
                    {t("adminDelete")}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default AdminClassManagement
