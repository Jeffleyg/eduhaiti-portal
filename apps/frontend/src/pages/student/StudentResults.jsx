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
  const [evolution, setEvolution] = useState({ overallAverage: 0, timeline: [], byDiscipline: [] })
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
          const defaultYearId = active?.id ?? years[0].id
          setSelectedAcademicYearId(defaultYearId)
          const evolutionData = await apiFetch(`/grades/evolution?academicYearId=${defaultYearId}`, { token })
          setEvolution(evolutionData)
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

  const handleAcademicYearChange = async (yearId) => {
    setSelectedAcademicYearId(yearId)
    try {
      const [yearGrades, evolutionData] = await Promise.all([
        apiFetch(yearId ? `/grades/my-grades?academicYearId=${yearId}` : "/grades/my-grades", { token }),
        apiFetch(yearId ? `/grades/evolution?academicYearId=${yearId}` : "/grades/evolution", { token }),
      ])
      setGrades(yearGrades ?? [])
      setEvolution(evolutionData ?? { overallAverage: 0, timeline: [], byDiscipline: [] })
      setError("")
    } catch (err) {
      setError(err.message)
    }
  }

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
          onChange={(event) => handleAcademicYearChange(event.target.value)}
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

      <section className="mt-6 rounded-2xl border border-brand-navy/10 bg-white p-5 space-y-4">
        <h3 className="text-lg font-semibold text-brand-navy">Evolucao de desempenho</h3>
        <p className="text-sm text-brand-navy/70">Media geral no periodo: {Number(evolution?.overallAverage ?? 0).toFixed(2)}/20</p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-brand-navy/10 p-4">
            <h4 className="font-semibold text-brand-navy mb-2">Linha do tempo mensal</h4>
            {evolution?.timeline?.length ? (
              <div className="space-y-2">
                {evolution.timeline.map((point) => (
                  <div key={point.period} className="flex items-center justify-between text-sm">
                    <span className="text-brand-navy/70">{point.period}</span>
                    <span className="font-semibold text-brand-navy">{point.average.toFixed(2)}/20</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-brand-navy/60">Sem dados suficientes para o periodo selecionado.</p>
            )}
          </div>

          <div className="rounded-xl border border-brand-navy/10 p-4">
            <h4 className="font-semibold text-brand-navy mb-2">Media por disciplina</h4>
            {evolution?.byDiscipline?.length ? (
              <div className="space-y-2">
                {evolution.byDiscipline.map((item) => (
                  <div key={item.disciplineId} className="flex items-center justify-between text-sm">
                    <span className="text-brand-navy/70">{item.disciplineName}</span>
                    <span className="font-semibold text-brand-navy">{item.average.toFixed(2)}/20</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-brand-navy/60">Sem dados por disciplina no periodo selecionado.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default StudentResults
