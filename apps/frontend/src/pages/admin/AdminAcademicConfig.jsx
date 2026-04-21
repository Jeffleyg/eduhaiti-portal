import { useState } from "react"
import { useTranslation } from "react-i18next"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"

const initialPeriod = {
  name: "",
  startDate: "",
  endDate: "",
  description: "",
}

const initialSettings = {
  passAverage: 10,
  maxAbsencesPerCourse: 5,
  assignmentLateDaysLimit: 2,
  gradeReviewWindowDays: 7,
}

function AdminAcademicConfig() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [schoolId, setSchoolId] = useState("")
  const [periodForm, setPeriodForm] = useState(initialPeriod)
  const [settingsForm, setSettingsForm] = useState(initialSettings)
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const clearFeedback = () => {
    setError("")
    setMessage("")
  }

  const loadPeriods = async () => {
    if (!schoolId.trim()) {
      setError(t("academicSchoolIdRequired"))
      return
    }

    setLoading(true)
    clearFeedback()
    try {
      const data = await apiFetch(`/admin/academic-periods?schoolId=${encodeURIComponent(schoolId)}`, {
        token,
      })
      setPeriods(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadSettings = async () => {
    if (!schoolId.trim()) {
      setError(t("academicSchoolIdRequired"))
      return
    }

    setLoading(true)
    clearFeedback()
    try {
      const data = await apiFetch(`/admin/academic-settings/${encodeURIComponent(schoolId)}`, { token })
      setSettingsForm({
        passAverage: Number(data.passAverage ?? 10),
        maxAbsencesPerCourse: Number(data.maxAbsencesPerCourse ?? 5),
        assignmentLateDaysLimit: Number(data.assignmentLateDaysLimit ?? 2),
        gradeReviewWindowDays: Number(data.gradeReviewWindowDays ?? 7),
      })
      setMessage(t("academicSettingsLoaded"))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createPeriod = async (event) => {
    event.preventDefault()
    if (!schoolId.trim()) {
      setError(t("academicSchoolIdRequired"))
      return
    }

    setLoading(true)
    clearFeedback()
    try {
      await apiFetch("/admin/academic-periods", {
        method: "POST",
        token,
        body: {
          ...periodForm,
          schoolId,
        },
      })
      setPeriodForm(initialPeriod)
      setMessage(t("academicPeriodCreated"))
      await loadPeriods()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const togglePeriod = async (period) => {
    setLoading(true)
    clearFeedback()
    try {
      await apiFetch(`/admin/academic-periods/${period.id}/${period.isOpen ? "close" : "open"}`, {
        method: "PATCH",
        token,
      })
      setMessage(t("academicPeriodUpdated"))
      await loadPeriods()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const removePeriod = async (periodId) => {
    setLoading(true)
    clearFeedback()
    try {
      await apiFetch(`/admin/academic-periods/${periodId}`, {
        method: "DELETE",
        token,
      })
      setMessage(t("academicPeriodDeleted"))
      await loadPeriods()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async (event) => {
    event.preventDefault()
    if (!schoolId.trim()) {
      setError(t("academicSchoolIdRequired"))
      return
    }

    setLoading(true)
    clearFeedback()
    try {
      await apiFetch(`/admin/academic-settings/${encodeURIComponent(schoolId)}`, {
        method: "PUT",
        token,
        body: settingsForm,
      })
      setMessage(t("academicSettingsSaved"))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title={t("academicAdminTitle")} subtitle={t("academicAdminSubtitle")} />

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6 space-y-4">
        <h3 className="text-base font-semibold text-brand-navy">{t("academicSchoolContext")}</h3>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1 text-sm text-brand-navy/70">
            {t("academicSchoolId")}
            <input
              value={schoolId}
              onChange={(event) => setSchoolId(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
              placeholder="school-uuid"
            />
          </label>
          <button className="outline-button" onClick={loadPeriods} disabled={loading} type="button">
            {t("academicLoadPeriods")}
          </button>
          <button className="outline-button" onClick={loadSettings} disabled={loading} type="button">
            {t("academicLoadSettings")}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h3 className="text-base font-semibold text-brand-navy">{t("academicCreatePeriod")}</h3>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createPeriod}>
          <input
            value={periodForm.name}
            onChange={(event) => setPeriodForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder={t("academicPeriodName")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <input
            type="date"
            value={periodForm.startDate}
            onChange={(event) => setPeriodForm((prev) => ({ ...prev, startDate: event.target.value }))}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <input
            type="date"
            value={periodForm.endDate}
            onChange={(event) => setPeriodForm((prev) => ({ ...prev, endDate: event.target.value }))}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <input
            value={periodForm.description}
            onChange={(event) => setPeriodForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder={t("academicPeriodDescription")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          />
          <button className="primary-button md:col-span-2" type="submit" disabled={loading}>
            {t("academicCreatePeriodAction")}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h3 className="text-base font-semibold text-brand-navy">{t("academicPeriodsList")}</h3>
        <div className="mt-4 space-y-3">
          {periods.length === 0 ? (
            <p className="text-sm text-brand-navy/60">{t("noData")}</p>
          ) : (
            periods.map((period) => (
              <div key={period.id} className="rounded-2xl border border-brand-navy/10 bg-white p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-brand-navy">{period.name}</p>
                    <p className="text-xs text-brand-navy/60">
                      {period.startDate?.slice(0, 10)} - {period.endDate?.slice(0, 10)}
                    </p>
                    <p className="text-xs text-brand-navy/60">{period.description || "-"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        period.isOpen ? "bg-emerald-100 text-emerald-700" : "bg-brand-red/10 text-brand-red"
                      }`}
                    >
                      {period.isOpen ? t("academicStatusOpen") : t("academicStatusClosed")}
                    </span>
                    <button className="outline-button" type="button" onClick={() => togglePeriod(period)}>
                      {period.isOpen ? t("academicClose") : t("academicOpen")}
                    </button>
                    <button className="outline-button" type="button" onClick={() => removePeriod(period.id)}>
                      {t("academicDelete")}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h3 className="text-base font-semibold text-brand-navy">{t("academicSettingsTitle")}</h3>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={saveSettings}>
          <label className="text-sm text-brand-navy/70">
            {t("academicPassAverage")}
            <input
              type="number"
              min="0"
              max="20"
              step="0.1"
              value={settingsForm.passAverage}
              onChange={(event) =>
                setSettingsForm((prev) => ({ ...prev, passAverage: Number(event.target.value) }))
              }
              className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-brand-navy/70">
            {t("academicMaxAbsences")}
            <input
              type="number"
              min="0"
              max="100"
              value={settingsForm.maxAbsencesPerCourse}
              onChange={(event) =>
                setSettingsForm((prev) => ({ ...prev, maxAbsencesPerCourse: Number(event.target.value) }))
              }
              className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-brand-navy/70">
            {t("academicLateDays")}
            <input
              type="number"
              min="0"
              max="30"
              value={settingsForm.assignmentLateDaysLimit}
              onChange={(event) =>
                setSettingsForm((prev) => ({ ...prev, assignmentLateDaysLimit: Number(event.target.value) }))
              }
              className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-brand-navy/70">
            {t("academicReviewWindow")}
            <input
              type="number"
              min="0"
              max="60"
              value={settingsForm.gradeReviewWindowDays}
              onChange={(event) =>
                setSettingsForm((prev) => ({ ...prev, gradeReviewWindowDays: Number(event.target.value) }))
              }
              className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            />
          </label>
          <button className="primary-button md:col-span-2" type="submit" disabled={loading}>
            {t("academicSaveSettings")}
          </button>
        </form>
      </section>
    </div>
  )
}

export default AdminAcademicConfig
