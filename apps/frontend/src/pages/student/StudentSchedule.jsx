import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"

function StudentSchedule() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const myClasses = await apiFetch("/classes/my-classes", { token })
        setClasses(myClasses ?? [])
      } catch (error) {
        console.error("Failed to fetch classes:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchClasses()
  }, [token])

  if (loading) {
    return <div className="text-center text-brand-navy">{t("loading")}</div>
  }

  return (
    <div>
      <SectionHeader title={t("navSchedule")} subtitle={t("scheduleSubtitle")} />
      <div className="space-y-3">
        {classes.length > 0 ? (
          classes.map((cls) => (
            <div
              key={cls.id}
              className="flex items-center justify-between rounded-2xl border border-brand-navy/10 bg-white px-4 py-4"
            >
              <div>
                <p className="font-semibold text-brand-navy">{cls.name}</p>
                <p className="text-sm text-brand-navy/60">{cls.teacher?.name ?? cls.teacher?.email}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-brand-navy/60">{t("noData")}</p>
        )}
      </div>
    </div>
  )
}

export default StudentSchedule
