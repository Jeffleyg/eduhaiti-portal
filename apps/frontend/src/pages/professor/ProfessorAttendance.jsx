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

// status labels are resolved inside the component with i18n

function ProfessorAttendance() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const statusOptions = [
    { value: "PRESENT", label: t("attendancePresent") },
    { value: "ABSENT", label: t("attendanceAbsent") },
    { value: "LATE", label: t("attendanceLate") },
    { value: "EXCUSED", label: t("attendanceExcused") },
  ]
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [attendance, setAttendance] = useState([])
  const [markings, setMarkings] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId),
    [classes, selectedClassId],
  )

  const loadClassAttendance = async (classId, dateValue) => {
    if (!classId) {
      setAttendance([])
      setMarkings({})
      return
    }

    setLoadingAttendance(true)
    try {
      const records = await apiFetch(`/attendance/class/${classId}?date=${dateValue}`, { token })
      const prepared = {}
      ;(records ?? []).forEach((record) => {
        prepared[record.studentId] = record.status
      })
      setAttendance(records ?? [])
      setMarkings(prepared)
    } finally {
      setLoadingAttendance(false)
    }
  }

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true)
      setError("")
      try {
        const classesData = await apiFetch("/classes/my-classes", { token })
        const preparedClasses = classesData ?? []
        setClasses(preparedClasses)
        if (preparedClasses.length) {
          const firstClassId = preparedClasses[0].id
          setSelectedClassId(firstClassId)
          await loadClassAttendance(firstClassId, selectedDate)
        }
      } catch (fetchError) {
        setError(fetchError.message)
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
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  const handleDateChange = async (value) => {
    setSelectedDate(value)
    setMessage("")
    setError("")
    try {
      await loadClassAttendance(selectedClassId, value)
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  const handleMarkingChange = (studentId, status) => {
    setMarkings((prev) => ({ ...prev, [studentId]: status }))
  }

  const submitAttendance = async () => {
    if (!selectedClassId) {
      setError(t("selectClassRequired"))
      return
    }

    const students = selectedClass?.students ?? []
    const toSend = students
      .map((student) => ({ studentId: student.id, status: markings[student.id] }))
      .filter((item) => Boolean(item.status))

    if (!toSend.length) {
      setError(t("markAtLeastOneStudent"))
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
      setMessage(t("attendanceSavedSuccess"))
      await loadClassAttendance(selectedClassId, selectedDate)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const markingColumns = [
    { key: "student", label: t("student") },
    { key: "enrollment", label: t("enrollmentNumber") },
    { key: "status", label: t("attendanceStatus") },
  ]

  const markingRows = (selectedClass?.students ?? []).map((student) => ({
    id: student.id,
    student: (
      <div>
        <p className="font-semibold text-brand-navy">{maskName(student.name ?? student.email, "student")}</p>
        <p className="text-xs text-brand-navy/60">{sanitizeText(student.email)}</p>
      </div>
    ),
    enrollment: student.enrollmentNumber ?? "-",
    status: (
      <div className="flex flex-wrap gap-2">
        {statusOptions.map((option) => {
          const isActive = markings[student.id] === option.value
          return (
            <Button
              key={option.value}
              type="button"
              variant={isActive ? "success" : "outline"}
              size="sm"
              onClick={() => handleMarkingChange(student.id, option.value)}
            >
              {option.label}
            </Button>
          )
        })}
      </div>
    ),
  }))

  const attendanceColumns = [
    { key: "student", label: t("student") },
    { key: "date", label: t("date") },
    { key: "status", label: t("attendanceStatus") },
  ]

  const attendanceRows = (attendance ?? []).map((record) => ({
    id: record.id,
    student: maskName(record.student?.name ?? record.student?.email, "student"),
    date: new Date(record.date).toLocaleDateString(),
    status: record.status,
  }))

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionHeader title={t("navAttendance")} subtitle={t("attendanceSubtitle")} />
        <SkeletonLoader type="dashboard" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionHeader title={t("navAttendance")} subtitle={t("attendanceSubtitle")} />

      {error ? <LoadingState type="banner" error={error} message={error} /> : null}
      {message ? <LoadingState type="banner" success={Boolean(message)} message={message} /> : null}

      <section className="grid gap-3 rounded-2xl border border-brand-navy/10 bg-white p-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium text-brand-navy">{t("classLabel")}</p>
          <Select
            value={selectedClassId}
            onValueChange={handleClassChange}
            options={classes.map((cls) => ({ value: cls.id, label: sanitizeText(cls.name) }))}
            placeholder={t("selectClass")}
            aria-label={t("selectClass")}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-brand-navy">{t("date")}</p>
          <Input
            type="date"
            value={selectedDate}
            onChange={(event) => void handleDateChange(event.target.value)}
            className="mt-0 bg-white"
          />
        </div>
      </section>

      {selectedClass ? (
        <section className="space-y-4 rounded-2xl border border-brand-navy/10 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-brand-navy">{sanitizeText(selectedClass.name)}</h3>
              <p className="text-sm text-brand-navy/60">{new Date(selectedDate).toLocaleDateString("pt-BR")}</p>
            </div>
            <Button type="button" variant="primary" onClick={submitAttendance} loading={submitting} disabled={submitting || !selectedClassId}>
              {t("submitAttendance")}
            </Button>
          </div>

          {selectedClass?.students?.length ? (
            <DataTablePaginated
              columns={markingColumns}
              rows={markingRows}
              loading={loadingAttendance}
              pageSize={10}
              totalCount={selectedClass.students.length}
              emptyMessage={t("noStudentsAssigned")}
            />
          ) : (
            <p className="text-sm text-brand-navy/60">{t("noData")}</p>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
        <h3 className="mb-4 font-semibold text-brand-navy">{t("attendanceRecordTitle")}</h3>
        <DataTablePaginated
          columns={attendanceColumns}
          rows={attendanceRows}
          loading={loadingAttendance && attendanceRows.length === 0}
          pageSize={10}
          totalCount={attendanceRows.length}
          emptyMessage={t("noAttendanceRecordsForDate")}
        />
      </section>
    </div>
  )
}

export default ProfessorAttendance
