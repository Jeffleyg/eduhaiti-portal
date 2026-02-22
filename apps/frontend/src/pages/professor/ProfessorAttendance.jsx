import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import DataTable from "../../components/DataTable.jsx"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"

function ProfessorAttendance() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const classes = await apiFetch("/classes/my-classes", { token })
        if (classes && classes[0]) {
          const classAttendance = await apiFetch(`/attendance/class/${classes[0].id}`, { token })
          setAttendance(classAttendance ?? [])
        }
      } catch (error) {
        console.error("Failed to fetch attendance:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()
  }, [token])

  if (loading) {
    return <div className="text-center text-brand-navy">{t("loading")}</div>
  }

  const columns = [
    { key: "student", label: t("student") },
    { key: "status", label: t("attendanceStatus") },
  ]

  const rows = (attendance ?? []).map((record) => ({
    student: record.student?.name ?? record.student?.email,
    status: record.status === "present" ? "Présent" : "Absent",
  }))

  return (
    <div>
      <SectionHeader title={t("navAttendance")} subtitle={t("attendanceSubtitle")} />
      <DataTable columns={columns} rows={rows.length > 0 ? rows : []} />
    </div>
  )
}

export default ProfessorAttendance
