import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import SectionHeader from "../../components/SectionHeader.jsx"
import Sidebar from "../../components/Sidebar.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import SectionCard from "../../components/SectionCard.jsx"
import SchoolContext from "../../components/admin/SchoolContext.jsx"
import PeriodForm from "../../components/admin/PeriodForm.jsx"
import PeriodsList from "../../components/admin/PeriodsList.jsx"
import SettingsForm from "../../components/admin/SettingsForm.jsx"
import Feedback from "../../components/Feedback.jsx"

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
  const { token, user } = useAuth()
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

  useEffect(() => {
    if (user?.schoolId) {
      setSchoolId(user.schoolId)
    }
  }, [user?.schoolId])

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
    <div className="flex gap-6">
      <Sidebar role="admin" />
      <main className="flex-1 space-y-6">
        <SectionHeader title={t("academicAdminTitle")} subtitle={t("academicAdminSubtitle")} />

        <Feedback error={error} message={message} />

        <SectionCard>
          <SchoolContext t={t} schoolId={schoolId} setSchoolId={setSchoolId} loadPeriods={loadPeriods} loadSettings={loadSettings} loading={loading} locked={Boolean(user?.schoolId)} />
        </SectionCard>

        <SectionCard>
          <PeriodForm t={t} periodForm={periodForm} setPeriodForm={setPeriodForm} createPeriod={createPeriod} loading={loading} />
        </SectionCard>

        <SectionCard>
          <h3 className="text-base font-semibold text-brand-navy">{t("academicPeriodsList")}</h3>
          <div className="mt-4">
            <PeriodsList t={t} periods={periods} togglePeriod={togglePeriod} removePeriod={removePeriod} />
          </div>
        </SectionCard>

        <SectionCard>
          <SettingsForm t={t} settingsForm={settingsForm} setSettingsForm={setSettingsForm} saveSettings={saveSettings} loading={loading} />
        </SectionCard>
      </main>
    </div>
  )
}

export default AdminAcademicConfig
