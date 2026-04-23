import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"
import DataTable from "../../components/DataTable.jsx"

function StudentSchedule() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [classes, setClasses] = useState([])
  const [todayAttendance, setTodayAttendance] = useState([])
  const [attendanceHistory, setAttendanceHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const today = new Date()
        const todayIso = today.toISOString().slice(0, 10)
        const monthStart = `${todayIso.slice(0, 8)}01`

        const [myClasses, myAttendance] = await Promise.all([
          apiFetch("/classes/my-classes", { token }),
          apiFetch(`/attendance/my-attendance?startDate=${monthStart}&endDate=${todayIso}`, { token }),
        ])

        setClasses(myClasses ?? [])

        const filtered = (myAttendance ?? [])
        setAttendanceHistory(filtered)

        const todayRecords = filtered.filter((item) => item.date?.slice(0, 10) === todayIso)
        const byClass = new Map(todayRecords.map((item) => [item.classId, item]))
        const todayByClass = (myClasses ?? []).map((cls) => ({
          classId: cls.id,
          className: cls.name,
          status: byClass.get(cls.id)?.status ?? "SEM_MARCACAO",
          date: byClass.get(cls.id)?.date ?? null,
        }))
        setTodayAttendance(todayByClass)
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

  const todayColumns = [
    { key: "class", label: "Turma" },
    { key: "status", label: t("attendanceStatus") },
  ]

  const todayRows = todayAttendance.map((item) => ({
    class: item.className,
    status: item.status,
  }))

  const historyColumns = [
    { key: "date", label: "Data" },
    { key: "class", label: "Turma" },
    { key: "status", label: t("attendanceStatus") },
  ]

  const historyRows = attendanceHistory.map((item) => ({
    date: new Date(item.date).toLocaleDateString("pt-BR"),
    class: item.class?.name ?? "-",
    status: item.status,
  }))

  return (
    <div className="space-y-5">
      <SectionHeader title={t("navSchedule")} subtitle={t("scheduleSubtitle")} />

      <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
        <h3 className="mb-3 font-semibold text-brand-navy">Presenca de hoje</h3>
        <DataTable columns={todayColumns} rows={todayRows.length ? todayRows : []} />
      </section>

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

      <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
        <h3 className="mb-3 font-semibold text-brand-navy">Historico de presenca (mes atual)</h3>
        <DataTable columns={historyColumns} rows={historyRows.length ? historyRows : []} />
      </section>
    </div>
  )
}

export default StudentSchedule
