import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import DataTablePaginated from "../../components/DataTablePaginated.jsx"
import SectionHeader from "../../components/SectionHeader.jsx"
import LoadingState from "../../components/LoadingState.jsx"
import SkeletonLoader from "../../components/SkeletonLoader.jsx"
import Button from "../../components/Button.jsx"
import Input from "../../components/Input.jsx"
import Select from "../../components/Select.jsx"
import { useTranslation } from "react-i18next"
import { sanitizeText, maskName } from "../../lib/string.js"

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
  const [loadingGrades, setLoadingGrades] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId),
    [classes, selectedClassId],
  )

  const gradeByStudent = useMemo(() => {
    return new Map((grades ?? []).map((grade) => [grade.studentId, grade]))
  }, [grades])

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

    setLoadingGrades(true)
    try {
      const suffix = disciplineId ? `?disciplineId=${disciplineId}` : ""
      const classGrades = await apiFetch(`/grades/class/${classId}${suffix}`, { token })
      setGrades(classGrades ?? [])
      return classGrades ?? []
    } finally {
      setLoadingGrades(false)
    }
  }

  const loadDisciplines = async (seriesId) => {
    if (!seriesId) {
      setDisciplines([])
      return []
    }

    const data = await apiFetch(`/disciplines?seriesId=${seriesId}`, { token })
    const prepared = data ?? []
    setDisciplines(prepared)
    return prepared
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

          const [classDisciplines, classGrades] = await Promise.all([
            loadDisciplines(firstClass.series?.id),
            loadGrades(firstClass.id),
          ])

          if (classDisciplines.length) {
            setSelectedDisciplineId(classDisciplines[0].id)
            const filteredGrades = await loadGrades(firstClass.id, classDisciplines[0].id)
            buildDraftsFromGrades(firstClass.id, filteredGrades, preparedClasses)
          } else {
            buildDraftsFromGrades(firstClass.id, classGrades, preparedClasses)
          }
        }
      } catch (fetchError) {
        setError(fetchError.message)
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
      const nextDisciplines = await loadDisciplines(nextClass?.series?.id)
      const classGrades = await loadGrades(classId)
      buildDraftsFromGrades(classId, classGrades)

      if (nextDisciplines.length) {
        setSelectedDisciplineId(nextDisciplines[0].id)
        const filteredGrades = await loadGrades(classId, nextDisciplines[0].id)
        buildDraftsFromGrades(classId, filteredGrades)
      }
    } catch (fetchError) {
      setError(fetchError.message)
    }
  }

  const handleDisciplineChange = async (disciplineId) => {
    setSelectedDisciplineId(disciplineId)
    setError("")
    setMessage("")

    try {
      const classGrades = await loadGrades(selectedClassId, disciplineId)
      buildDraftsFromGrades(selectedClassId, classGrades)
    } catch (fetchError) {
      setError(fetchError.message)
    }
  }

  const handleDraftChange = (studentId, value) => {
    setGradeDrafts((prev) => ({ ...prev, [studentId]: value }))
  }

  const handleCreateGrade = async (event) => {
    event.preventDefault()

    if (!selectedClassId || !selectedDisciplineId) {
      setError(t("selectClassAndDiscipline"))
      return
    }

    const numericMaxScore = Number(maxScore)
    if (Number.isNaN(numericMaxScore) || numericMaxScore <= 0) {
      setError(t("maxScoreMustBePositive"))
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
      setError(t("requiresNote"))
      return
    }

    const parsedEntries = []

    for (const entry of entries) {
      const numericScore = Number(entry.rawScore)
      if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > numericMaxScore) {
        setError(t("gradesInRange"))
        return
      }
      parsedEntries.push({ studentId: entry.studentId, score: numericScore })
    }

    if (!selectedClass?.academicYear?.id) {
      setError(t("academicYearNotFound"))
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
      setMessage(`${parsedEntries.length} ${t("gradesSaved")}`)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePublish = async () => {
    if (!selectedClassId || !selectedDisciplineId) {
      setError(t("selectClassAndDiscipline"))
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
      setMessage(t("gradesPublishedSuccess"))
      await loadGrades(selectedClassId, selectedDisciplineId)
    } catch (publishError) {
      setError(publishError.message)
    } finally {
      setPublishing(false)
    }
  }

  const editableColumns = [
    { key: "student", label: t("student") },
    { key: "enrollment", label: t("enrollmentNumber") },
    { key: "current", label: t("currentLabel") || 'Current' },
    { key: "draft", label: t("grade") },
  ]

  const editableRows = (selectedClass?.students ?? []).map((student) => {
    const existingGrade = gradeByStudent.get(student.id)

    return {
      id: student.id,
      student: (
        <div>
          <p className="font-semibold text-brand-navy">{maskName(student.name ?? student.email, "student")}</p>
          <p className="text-xs text-brand-navy/60">{sanitizeText(student.email)}</p>
        </div>
      ),
      enrollment: student.enrollmentNumber ?? "-",
      current: existingGrade ? `${existingGrade.score}/${existingGrade.maxScore} (${existingGrade.status})` : "Sem nota",
      draft: (
        <Input
          type="number"
          step="0.01"
          min="0"
          max={maxScore || undefined}
          value={gradeDrafts[student.id] ?? ""}
          onChange={(event) => handleDraftChange(student.id, event.target.value)}
          placeholder={t("enterGrade")}
          className="mt-0 bg-white"
          disabled={!selectedDisciplineId}
        />
      ),
    }
  })

  const historyColumns = [
    { key: "student", label: t("student") },
    { key: "subject", label: t("subject") },
    { key: "score", label: t("grade") },
    { key: "status", label: t("status") },
  ]

  const historyRows = (grades ?? []).map((grade) => ({
    id: grade.id,
    student: maskName(grade.student?.name ?? grade.student?.email, "student"),
    subject: sanitizeText(grade.discipline?.name ?? "-"),
    score: `${grade.score}/${grade.maxScore}`,
    status: grade.status === "DRAFT" ? t("gradeDraft") : t("gradePublished"),
  }))

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionHeader title={t("navGrades")} subtitle={t("gradesSubtitle")} />
        <SkeletonLoader type="dashboard" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionHeader title={t("navGrades")} subtitle={t("gradesSubtitle")} />

      {error ? <LoadingState type="banner" error={error} message={error} /> : null}
      {message ? <LoadingState type="banner" success={Boolean(message)} message={message} /> : null}

      <section className="grid gap-3 rounded-2xl border border-brand-navy/10 bg-white p-4 md:grid-cols-3">
        <div className="space-y-2">
          <p className="text-sm font-medium text-brand-navy">Turma</p>
          <Select
            value={selectedClassId}
            onValueChange={handleClassChange}
            options={classes.map((cls) => ({ value: cls.id, label: cls.name }))}
            placeholder={t("selectClass")}
            aria-label={t("selectClass")}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-brand-navy">Disciplina</p>
          <Select
            value={selectedDisciplineId}
            onValueChange={handleDisciplineChange}
            options={disciplines.map((discipline) => ({ value: discipline.id, label: discipline.name }))}
            placeholder={t("selectDiscipline")}
            aria-label={t("selectDiscipline")}
            disabled={!selectedClassId}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-brand-navy">Nota máxima</p>
          <Input
            type="number"
            step="0.01"
            min="1"
            value={maxScore}
            onChange={(event) => setMaxScore(event.target.value)}
            placeholder={t("maxScore")}
            className="mt-0 bg-white"
          />
        </div>
      </section>

      <form className="space-y-4 rounded-2xl border border-brand-navy/10 bg-white p-4" onSubmit={handleCreateGrade}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-brand-navy">{t("gradeEntryTitle") || 'Entry'}</h3>
            <p className="text-sm text-brand-navy/60">{t("gradeEntrySubtitle") || 'Edit the grade directly in the table and then save.'}</p>
          </div>
          <Button type="submit" variant="primary" loading={submitting} disabled={submitting || !selectedClassId || !selectedDisciplineId}>
            {t("saveGrades")}
          </Button>
        </div>

        {selectedClass?.students?.length ? (
          <DataTablePaginated
            columns={editableColumns}
            rows={editableRows}
            loading={loadingGrades}
            pageSize={10}
            totalCount={selectedClass.students.length}
            emptyMessage={t("noStudentsAssigned") || 'No students assigned to this class.'}
          />
        ) : (
          <p className="text-sm text-brand-navy/60">{t("noData")}</p>
        )}
      </form>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={handlePublish}
          loading={publishing}
          disabled={publishing || !selectedClassId || !selectedDisciplineId}
        >
          {t("publishGrades")}
        </Button>
      </div>

      <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
        <h3 className="mb-4 font-semibold text-brand-navy">{t("gradesHistory") || 'Grades history'}</h3>
        <DataTablePaginated
          columns={historyColumns}
          rows={historyRows}
          loading={loadingGrades && historyRows.length === 0}
          pageSize={10}
          totalCount={historyRows.length}
          emptyMessage={t("noGrades")}
        />
      </section>
    </div>
  )
}

export default ProfessorGrades
