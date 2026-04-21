import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import DataTable from "../../components/DataTable.jsx"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

function StudentResults() {
  const { t } = useTranslation()
  const { token, user } = useAuth()
  const [grades, setGrades] = useState([])
  const [academicYears, setAcademicYears] = useState([])
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const [myGrades, years] = await Promise.all([
          apiFetch("/grades/my-grades", { token }),
          apiFetch("/grades/my-academic-years", { token }),
        ])
        setGrades(myGrades ?? [])
        setAcademicYears(years ?? [])
        if (years?.length > 0) {
          const active = years.find((item) => item.isActive)
          setSelectedAcademicYearId(active?.id ?? years[0].id)
        }
      } catch (error) {
        setError(error.message)
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
    subject: grade.discipline?.name ?? grade.subject,
    grade: `${grade.score}/${grade.maxScore}`,
    status: grade.status === "DRAFT" ? t("gradeDraft") : t("gradePublished"),
  }))

  const generateTranscriptPdf = async () => {
    if (!selectedAcademicYearId) {
      setError(t("transcriptSelectYear"))
      return
    }

    try {
      const report = await apiFetch(`/grades/report/${selectedAcademicYearId}`, { token })
      const selectedYear = academicYears.find((item) => item.id === selectedAcademicYearId)
      const doc = new jsPDF()

      doc.setFontSize(16)
      doc.text(t("transcriptTitle"), 14, 16)
      doc.setFontSize(11)
      doc.text(`${t("student")}: ${user?.name ?? user?.email ?? "-"}`, 14, 25)
      doc.text(`${t("academicYear")}: ${selectedYear?.year ?? "-"}`, 14, 31)

      const tableRows = (report.grades ?? []).map((item) => [
        item.discipline?.name ?? "-",
        item.class?.name ?? "-",
        `${item.score}/${item.maxScore}`,
        `${((item.score / item.maxScore) * 100).toFixed(1)}%`,
      ])

      autoTable(doc, {
        head: [[t("subject"), t("className"), t("grade"), t("average")]],
        body: tableRows,
        startY: 38,
      })

      const total = (report.grades ?? []).reduce((sum, g) => sum + g.score / g.maxScore, 0)
      const avg = report.grades?.length ? (total / report.grades.length) * 20 : 0
      const finalY = doc.lastAutoTable?.finalY ?? 50
      doc.text(`${t("average")}: ${avg.toFixed(2)}/20`, 14, finalY + 10)

      const filename = `historico-${selectedYear?.year ?? "academico"}.pdf`
      doc.save(filename)
      setError("")
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <SectionHeader title={t("navResults")} subtitle={t("resultsSubtitle")} />
      {error ? <p className="mb-3 text-sm text-brand-red">{error}</p> : null}
      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <select
          value={selectedAcademicYearId}
          onChange={(event) => setSelectedAcademicYearId(event.target.value)}
          className="rounded-2xl border border-brand-navy/10 bg-white px-3 py-2 text-sm"
        >
          <option value="">{t("transcriptSelectYear")}</option>
          {academicYears.map((year) => (
            <option key={year.id} value={year.id}>
              {year.year}
            </option>
          ))}
        </select>
        <button
          className="primary-button"
          type="button"
          onClick={generateTranscriptPdf}
          disabled={!selectedAcademicYearId}
        >
          {t("downloadTranscriptPdf")}
        </button>
      </div>
      <DataTable columns={columns} rows={rows.length > 0 ? rows : []} />
    </div>
  )
}

export default StudentResults
