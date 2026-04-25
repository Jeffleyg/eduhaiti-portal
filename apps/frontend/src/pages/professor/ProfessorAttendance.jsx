import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import DataTable from "../../components/DataTable.jsx"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"

const statusOptions = [
  { value: "PRESENT", label: "Presente" },
  { value: "ABSENT", label: "Ausente" },
  { value: "LATE", label: "Atrasado" },
  { value: "EXCUSED", label: "Justificado" },
]

function ProfessorAttendance() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [attendance, setAttendance] = useState([])
  const [markings, setMarkings] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const selectedClass = classes.find((item) => item.id === selectedClassId)

  const loadClassAttendance = async (classId, dateValue) => {
    if (!classId) {
      setAttendance([])
      setMarkings({})
      return
    }

    const records = await apiFetch(`/attendance/class/${classId}?date=${dateValue}`, { token })
    const prepared = {}
    ;(records ?? []).forEach((record) => {
      prepared[record.studentId] = record.status
    })
    setAttendance(records ?? [])
    setMarkings(prepared)
  }

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true)
      setError("")
      try {
        const classesData = await apiFetch("/classes/my-classes", { token })
        setClasses(classesData ?? [])
        if (classesData?.length) {
          setSelectedClassId(classesData[0].id)
          await loadClassAttendance(classesData[0].id, selectedDate)
        }
      } catch (error) {
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()
  }, [token])

  const handleClassChange = async (classId) => {
    setSelectedClassId(classId)
    setMessage("")
    setError("")
    try {
      await loadClassAttendance(classId, selectedDate)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDateChange = async (value) => {
    setSelectedDate(value)
    setMessage("")
    setError("")
    try {
      await loadClassAttendance(selectedClassId, value)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleMarkingChange = (studentId, status) => {
    setMarkings((prev) => ({ ...prev, [studentId]: status }))
  }

  const submitAttendance = async () => {
    if (!selectedClassId) {
      setError("Selecione uma turma.")
      return
    }

    const students = selectedClass?.students ?? []
    const toSend = students
      .map((student) => ({ studentId: student.id, status: markings[student.id] }))
      .filter((item) => Boolean(item.status))

    if (!toSend.length) {
      setError("Marque ao menos um aluno.")
      return
    }

    setSubmitting(true)
    setError("")
    setMessage("")
    try {
      await Promise.all(
        toSend.map((item) =>
          apiFetch("/admin/attendance", {
            method: "POST",
            token,
            body: {
              studentId: item.studentId,
              classId: selectedClassId,
              date: selectedDate,
              status: item.status,
            },
          }),
        ),
      )
      setMessage("Presenca lancada com sucesso.")
      await loadClassAttendance(selectedClassId, selectedDate)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center text-brand-navy">{t("loading")}</div>
  }

  const columns = [
    { key: "student", label: t("student") },
    { key: "date", label: "Data" },
    { key: "status", label: t("attendanceStatus") },
  ]

  const rows = (attendance ?? []).map((record) => ({
    student: record.student?.name ?? record.student?.email,
    date: new Date(record.date).toLocaleDateString("pt-BR"),
    status: record.status,
  }))

  return (
    <div className="space-y-4">
      <SectionHeader title={t("navAttendance")} subtitle={t("attendanceSubtitle")} />

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <section className="rounded-2xl border border-brand-navy/10 bg-white p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
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

          <input
            type="date"
            value={selectedDate}
            onChange={(event) => handleDateChange(event.target.value)}
            className="rounded-xl border border-brand-navy/20 px-3 py-2"
          />
        </div>

        {selectedClass?.students?.length ? (
          <div className="space-y-2">
            {selectedClass.students.map((student) => (
              <div key={student.id} className="grid gap-2 md:grid-cols-[1fr_220px] md:items-center rounded-xl border border-brand-navy/10 p-3">
                <div>
                  <p className="font-semibold text-brand-navy">{student.name ?? student.email}</p>
                  <p className="text-xs text-brand-navy/60">{student.enrollmentNumber ?? "-"}</p>
                </div>
                <select
                  value={markings[student.id] ?? ""}
                  onChange={(event) => handleMarkingChange(student.id, event.target.value)}
                  className="rounded-xl border border-brand-navy/20 px-3 py-2"
                >
                  <option value="">Sem marcacao</option>
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-brand-navy/60">{t("noData")}</p>
        )}

        <button type="button" className="primary-button" onClick={submitAttendance} disabled={submitting || !selectedClassId}>
          {submitting ? "Salvando..." : "Lancar presenca"}
        </button>
      </section>

      <DataTable columns={columns} rows={rows.length > 0 ? rows : []} />
    </div>
  )
}

export default ProfessorAttendance
