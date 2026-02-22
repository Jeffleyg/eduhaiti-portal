import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import DataTable from "../../components/DataTable.jsx"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"

function StudentResults() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const myGrades = await apiFetch("/grades/my-grades", { token })
        setGrades(myGrades ?? [])
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
    { key: "subject", label: t("subject") },
    { key: "grade", label: t("grade") },
    { key: "status", label: t("status") },
  ]

  const rows = (grades ?? []).map((grade) => ({
    subject: grade.subject,
    grade: `${grade.score}/${grade.maxScore}`,
    status: grade.status === "draft" ? "Rascunho" : "Publicado",
  }))

  return (
    <div>
      <SectionHeader title={t("navResults")} subtitle={t("resultsSubtitle")} />
      <DataTable columns={columns} rows={rows.length > 0 ? rows : []} />
    </div>
  )
}

export default StudentResults
