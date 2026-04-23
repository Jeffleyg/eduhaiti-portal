import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import DataTable from "../../components/DataTable.jsx"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"

function ProfessorGrades() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [classes, setClasses] = useState([])
  const [disciplines, setDisciplines] = useState([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [selectedDisciplineId, setSelectedDisciplineId] = useState("")
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [score, setScore] = useState("")
  const [maxScore, setMaxScore] = useState("20")
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const selectedClass = classes.find((item) => item.id === selectedClassId)

  const loadGrades = async (classId, disciplineId) => {
    if (!classId) {
      setGrades([])
      return
    }

    const suffix = disciplineId ? `?disciplineId=${disciplineId}` : ""
    const classGrades = await apiFetch(`/grades/class/${classId}${suffix}`, { token })
    setGrades(classGrades ?? [])
  }

  const loadDisciplines = async (seriesId) => {
    if (!seriesId) {
      setDisciplines([])
      return
    }

    const data = await apiFetch(`/disciplines?seriesId=${seriesId}`, { token })
    setDisciplines(data ?? [])
  }

  useEffect(() => {
    const fetchGrades = async () => {
      setLoading(true)
      setError("")
      try {
        const classesData = await apiFetch("/classes/my-classes", { token })
        setClasses(classesData ?? [])

        if (classesData?.length) {
          const firstClass = classesData[0]
          setSelectedClassId(firstClass.id)

          await Promise.all([
            loadDisciplines(firstClass.series?.id),
            loadGrades(firstClass.id),
          ])
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
    { key: "student", label: t("student") },
    { key: "subject", label: t("subject") },
    { key: "score", label: t("grade") },
    { key: "status", label: t("status") },
  ]

  const rows = (grades ?? []).map((grade) => ({
    student: grade.student?.name ?? grade.student?.email,
    subject: grade.discipline?.name ?? "-",
    score: `${grade.score}/${grade.maxScore}`,
    status: grade.status === "DRAFT" ? t("gradeDraft") : t("gradePublished"),
  }))

  const handleClassChange = async (classId) => {
    setSelectedClassId(classId)
    setSelectedDisciplineId("")
    setSelectedStudentId("")
    setError("")
    setMessage("")

    const nextClass = classes.find((item) => item.id === classId)
    try {
      await Promise.all([
        loadDisciplines(nextClass?.series?.id),
        loadGrades(classId),
      ])
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDisciplineChange = async (disciplineId) => {
    setSelectedDisciplineId(disciplineId)
    setError("")
    setMessage("")

    try {
      await loadGrades(selectedClassId, disciplineId)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCreateGrade = async (event) => {
    event.preventDefault()

    if (!selectedClassId || !selectedDisciplineId || !selectedStudentId || score === "") {
      setError("Preencha turma, disciplina, aluno e nota.")
      return
    }

    const numericScore = Number(score)
    const numericMaxScore = Number(maxScore)

    if (Number.isNaN(numericScore) || Number.isNaN(numericMaxScore) || numericMaxScore <= 0 || numericScore < 0 || numericScore > numericMaxScore) {
      setError("A nota precisa estar entre 0 e a nota maxima.")
      return
    }

    setSubmitting(true)
    setError("")
    setMessage("")

    try {
      await apiFetch("/admin/grades", {
        method: "POST",
        token,
        body: {
          studentId: selectedStudentId,
          classId: selectedClassId,
          disciplineId: selectedDisciplineId,
          academicYearId: selectedClass?.academicYear?.id,
          score: numericScore,
          maxScore: numericMaxScore,
        },
      })

      setScore("")
      setMessage("Nota lancada com sucesso.")
      await loadGrades(selectedClassId, selectedDisciplineId)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePublish = async () => {
    if (!selectedClassId || !selectedDisciplineId) {
      setError("Selecione turma e disciplina para publicar.")
      return
    }

    setPublishing(true)
    setError("")
    setMessage("")
    try {
      await apiFetch(`/admin/grades/${selectedClassId}/publish?disciplineId=${selectedDisciplineId}`, {
        method: "POST",
        token,
      })
      setMessage("Notas publicadas com sucesso.")
      await loadGrades(selectedClassId, selectedDisciplineId)
    } catch (err) {
      setError(err.message)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader title={t("navGrades")} subtitle={t("gradesSubtitle")} />

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <section className="grid gap-3 rounded-2xl border border-brand-navy/10 bg-white p-4 md:grid-cols-2">
        <select
          value={selectedClassId}
          onChange={(event) => handleClassChange(event.target.value)}
          className="rounded-xl border border-brand-navy/20 px-3 py-2"
        >
          <option value="">Selecione a turma</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>{cls.name}</option>
          ))}
        </select>

        <select
          value={selectedDisciplineId}
          onChange={(event) => handleDisciplineChange(event.target.value)}
          className="rounded-xl border border-brand-navy/20 px-3 py-2"
          disabled={!selectedClassId}
        >
          <option value="">Selecione a disciplina</option>
          {disciplines.map((discipline) => (
            <option key={discipline.id} value={discipline.id}>{discipline.name}</option>
          ))}
        </select>
      </section>

      <form className="grid gap-3 rounded-2xl border border-brand-navy/10 bg-white p-4 md:grid-cols-5" onSubmit={handleCreateGrade}>
        <select
          value={selectedStudentId}
          onChange={(event) => setSelectedStudentId(event.target.value)}
          className="rounded-xl border border-brand-navy/20 px-3 py-2 md:col-span-2"
          disabled={!selectedClassId}
        >
          <option value="">Selecione o aluno</option>
          {(selectedClass?.students ?? []).map((student) => (
            <option key={student.id} value={student.id}>{student.name ?? student.email}</option>
          ))}
        </select>

        <input
          type="number"
          step="0.01"
          min="0"
          value={score}
          onChange={(event) => setScore(event.target.value)}
          placeholder="Nota"
          className="rounded-xl border border-brand-navy/20 px-3 py-2"
        />

        <input
          type="number"
          step="0.01"
          min="1"
          value={maxScore}
          onChange={(event) => setMaxScore(event.target.value)}
          placeholder="Nota maxima"
          className="rounded-xl border border-brand-navy/20 px-3 py-2"
        />

        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Salvando..." : "Lancar nota"}
        </button>
      </form>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handlePublish}
          className="outline-button"
          disabled={publishing || !selectedClassId || !selectedDisciplineId}
        >
          {publishing ? "Publicando..." : "Publicar notas"}
        </button>
      </div>

      <DataTable columns={columns} rows={rows.length > 0 ? rows : []} />
    </div>
  )
}

export default ProfessorGrades
