import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import StatCard from "../../components/StatCard.jsx"
import { useTranslation } from "react-i18next"

function ProfessorDashboard() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [stats, setStats] = useState({})
  const [recentMessages, setRecentMessages] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classesRes, messagesRes] = await Promise.all([
          apiFetch("/classes/my-classes", { token }),
          apiFetch("/messages/inbox", { token }),
        ])

        setClasses(classesRes ?? [])
        setRecentMessages((messagesRes ?? []).slice(0, 3))
        setStats({
          attendance: "96%",
          grades: classesRes && classesRes[0] ? "~24" : "0",
          messages: (messagesRes ?? []).length,
          tasks: "18",
        })
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [token])

  if (loading) {
    return <div className="text-center text-brand-navy">{t("loading")}</div>
  }

  return (
    <div className="space-y-6">
      <SectionHeader title={t("navOverview")} subtitle={t("professorDashboardIntro")} />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label={t("metricAttendance")} value={stats.attendance ?? "0"} />
        <StatCard label={t("metricGrades")} value={stats.grades ?? "0"} />
        <StatCard label={t("metricMessages")} value={stats.messages ?? "0"} />
        <StatCard label={t("metricTasks")} value={stats.tasks ?? "0"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
          <SectionHeader title={t("myClasses")} />
          <div className="space-y-3">
            {classes.length > 0 ? (
              classes.map((cls) => (
                <div key={cls.id} className="flex items-center justify-between rounded-2xl bg-sand px-4 py-3 text-sm">
                  <span className="font-semibold text-brand-navy">{cls.name}</span>
                  <span className="text-brand-navy/70">{cls.students?.length ?? 0} {t("students")}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-brand-navy/60">{t("noData")}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
          <SectionHeader title={t("recentMessages")} />
          <div className="space-y-3">
            {recentMessages.length > 0 ? (
              recentMessages.map((message) => (
                <div key={message.id} className="flex items-center justify-between rounded-2xl bg-sand px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-brand-navy">{message.from?.name ?? message.from?.email}</p>
                    <p className="text-brand-navy/70">{message.subject}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-brand-navy/60">{t("noData")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfessorDashboard
