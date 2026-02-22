import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import DataTable from "../../components/DataTable.jsx"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"

function ProfessorGrades() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const classes = await apiFetch("/classes/my-classes", { token })
        if (classes && classes[0]) {
          const classGrades = await apiFetch(`/grades/class/${classes[0].id}`, { token })
          setGrades(classGrades ?? [])
        }
      } catch (error) {
        console.error("Failed to fetch grades:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchGrades()
  }, [token])

  if (loading) {
    return <div className="text-center text-brand-navy">{t("loading")}</div>
  }

  const columns = [
    { key: "student", label: t("student") },
    { key: "subject", label: t("subject") },
    { key: "score", label: t("grade") },
    { key: "status", label: t("status") },
  ]

  const rows = (grades ?? []).map((grade) => ({
    student: grade.student?.name ?? grade.student?.email,
    subject: grade.subject,
    score: `${grade.score}/${grade.maxScore}`,
    status: grade.status === "draft" ? "Rascunho" : "Publicado",
  }))

  return (
    <div>
      <SectionHeader title={t("navGrades")} subtitle={t("gradesSubtitle")} />
      <DataTable columns={columns} rows={rows.length > 0 ? rows : []} />
    </div>
  )
}

export default ProfessorGrades
