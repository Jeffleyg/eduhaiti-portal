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
  const [gradeDrafts, setGradeDrafts] = useState({})
  const [maxScore, setMaxScore] = useState("20")
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const selectedClass = classes.find((item) => item.id === selectedClassId)

  const buildDraftsFromGrades = (classId, records, classList = classes) => {
    const classStudents = classList.find((item) => item.id === classId)?.students ?? []
    const byStudent = new Map((records ?? []).map((grade) => [grade.studentId, String(grade.score)]))
    const drafts = {}

    classStudents.forEach((student) => {
      drafts[student.id] = byStudent.get(student.id) ?? ""
    })

    setGradeDrafts(drafts)
  }

  const loadGrades = async (classId, disciplineId) => {
    if (!classId) {
      setGrades([])
      setGradeDrafts({})
      return []
    }

    const suffix = disciplineId ? `?disciplineId=${disciplineId}` : ""
    const classGrades = await apiFetch(`/grades/class/${classId}${suffix}`, { token })
    setGrades(classGrades ?? [])
    return classGrades ?? []
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
        const preparedClasses = classesData ?? []
        setClasses(preparedClasses)

        if (preparedClasses.length) {
          const firstClass = preparedClasses[0]
          setSelectedClassId(firstClass.id)

          const [, classGrades] = await Promise.all([
            loadDisciplines(firstClass.series?.id),
            loadGrades(firstClass.id),
          ])

          buildDraftsFromGrades(firstClass.id, classGrades, preparedClasses)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchGrades()
  }, [token])

  const handleClassChange = async (classId) => {
    setSelectedClassId(classId)
    setSelectedDisciplineId("")
    setGradeDrafts({})
    setError("")
    setMessage("")

    const nextClass = classes.find((item) => item.id === classId)

    try {
      const [, classGrades] = await Promise.all([
        loadDisciplines(nextClass?.series?.id),
        loadGrades(classId),
      ])

      buildDraftsFromGrades(classId, classGrades)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDisciplineChange = async (disciplineId) => {
    setSelectedDisciplineId(disciplineId)
    setError("")
    setMessage("")

    try {
      const classGrades = await loadGrades(selectedClassId, disciplineId)
      buildDraftsFromGrades(selectedClassId, classGrades)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDraftChange = (studentId, value) => {
    setGradeDrafts((prev) => ({ ...prev, [studentId]: value }))
  }

  const handleCreateGrade = async (event) => {
    event.preventDefault()

    if (!selectedClassId || !selectedDisciplineId) {
      setError("Selecione turma e disciplina.")
      return
    }

    const numericMaxScore = Number(maxScore)
    if (Number.isNaN(numericMaxScore) || numericMaxScore <= 0) {
      setError("A nota maxima precisa ser maior que zero.")
      return
    }

    const students = selectedClass?.students ?? []
    const entries = students
      .map((student) => ({
        studentId: student.id,
        rawScore: gradeDrafts[student.id],
      }))
      .filter((item) => item.rawScore !== "" && item.rawScore !== undefined)

    if (!entries.length) {
      setError("Informe ao menos uma nota para salvar.")
      return
    }

    const parsedEntries = []

    for (const entry of entries) {
      const numericScore = Number(entry.rawScore)
      if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > numericMaxScore) {
        setError("Cada nota precisa estar entre 0 e a nota maxima.")
        return
      }
      parsedEntries.push({ studentId: entry.studentId, score: numericScore })
    }

    if (!selectedClass?.academicYear?.id) {
      setError("Nao foi possivel identificar o ano academico da turma.")
      return
    }

    setSubmitting(true)
    setError("")
    setMessage("")

    try {
      await Promise.all(
        parsedEntries.map((entry) =>
          apiFetch("/admin/grades", {
            method: "POST",
            token,
            body: {
              studentId: entry.studentId,
              classId: selectedClassId,
              disciplineId: selectedDisciplineId,
              academicYearId: selectedClass.academicYear.id,
              score: entry.score,
              maxScore: numericMaxScore,
            },
          }),
        ),
      )

      const classGrades = await loadGrades(selectedClassId, selectedDisciplineId)
      buildDraftsFromGrades(selectedClassId, classGrades)
      setMessage(`${parsedEntries.length} nota(s) salva(s) com sucesso.`)
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

      <form className="space-y-3 rounded-2xl border border-brand-navy/10 bg-white p-4" onSubmit={handleCreateGrade}>
        <input
          type="number"
          step="0.01"
          min="1"
          value={maxScore}
          onChange={(event) => setMaxScore(event.target.value)}
          placeholder="Nota maxima"
          className="w-full rounded-xl border border-brand-navy/20 px-3 py-2 md:w-56"
        />

        {selectedClass?.students?.length ? (
          <div className="space-y-2">
            {selectedClass.students.map((student) => {
              const existingGrade = grades.find((item) => item.studentId === student.id)

              return (
                <div key={student.id} className="grid gap-2 rounded-xl border border-brand-navy/10 p-3 md:grid-cols-[1fr_200px] md:items-center">
                  <div>
                    <p className="font-semibold text-brand-navy">{student.name ?? student.email}</p>
                    <p className="text-xs text-brand-navy/60">{student.enrollmentNumber ?? "-"}</p>
                    <p className="text-xs text-brand-navy/60">
                      {existingGrade ? `Atual: ${existingGrade.score}/${existingGrade.maxScore} (${existingGrade.status})` : "Sem nota registrada"}
                    </p>
                  </div>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={maxScore || undefined}
                    value={gradeDrafts[student.id] ?? ""}
                    onChange={(event) => handleDraftChange(student.id, event.target.value)}
                    placeholder="Nota"
                    className="rounded-xl border border-brand-navy/20 px-3 py-2"
                    disabled={!selectedDisciplineId}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-brand-navy/60">{t("noData")}</p>
        )}

        <button type="submit" className="primary-button" disabled={submitting || !selectedClassId || !selectedDisciplineId}>
          {submitting ? "Salvando..." : "Salvar notas da turma"}
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
