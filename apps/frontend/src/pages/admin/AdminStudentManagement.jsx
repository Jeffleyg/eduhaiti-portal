import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"

function AdminStudentManagement() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [selectedClassId, setSelectedClassId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadData = async () => {
    setLoading(true)
    setError("")
    try {
      const [studentsData, classesData] = await Promise.all([
        apiFetch("/admin/users/students", { token }),
        apiFetch("/admin/classes", { token }),
      ])
      setStudents(studentsData ?? [])
      setClasses(classesData ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      loadData()
    }
  }, [token])

  const enrollStudent = async (studentId, classId) => {
    if (!classId.trim()) {
      setError(t("adminSelectClassRequired"))
      return
    }

    setLoading(true)
    setError("")
    setMessage("")
    try {
      await apiFetch(`/admin/classes/${classId}/enroll`, {
        method: "POST",
        token,
        body: { studentId },
      })
      setMessage(t("adminStudentEnrolled"))
      setSelectedStudent(null)
      setSelectedClassId("")
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const removeStudentFromClass = async (studentId, classId) => {
    setLoading(true)
    setError("")
    setMessage("")
    try {
      await apiFetch(`/admin/classes/${classId}/students/${studentId}`, {
        method: "DELETE",
        token,
      })
      setMessage(t("adminStudentRemoved"))
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("adminStudentManagementTitle")}
        subtitle={t("adminStudentManagementSubtitle")}
      />

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h3 className="text-base font-semibold text-brand-navy">{t("adminStudentList")}</h3>

        {loading ? (
          <p className="mt-4 text-sm text-brand-navy/60">{t("loading")}</p>
        ) : students.length === 0 ? (
          <p className="mt-4 text-sm text-brand-navy/60">{t("noData")}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {students.map((student) => (
              <div
                key={student.id}
                className="rounded-2xl border border-brand-navy/10 bg-white p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-brand-navy">{student.name}</p>
                    <p className="text-xs text-brand-navy/60">{student.email}</p>
                    <p className="text-xs text-brand-navy/60">
                      {t("adminStudentEnrollmentNumber")}: {student.enrollmentNumber}
                    </p>
                    {student.classesAttending?.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {student.classesAttending.map((cls) => (
                          <div key={cls.id} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-brand-navy/70">
                              {cls.name} ({cls.level})
                            </span>
                            <button
                              className="text-xs text-brand-red hover:underline"
                              onClick={() => removeStudentFromClass(student.id, cls.id)}
                              disabled={loading}
                            >
                              {t("adminRemove")}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-brand-navy/50">{t("adminNotEnrolled")}</p>
                    )}
                  </div>

                  {selectedStudent?.id === student.id ? (
                    <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
                      <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                      >
                        <option value="">{t("adminSelectClass")}</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name} ({cls.level})
                          </option>
                        ))}
                      </select>
                      <button
                        className="primary-button"
                        onClick={() => enrollStudent(student.id, selectedClassId)}
                        disabled={loading}
                      >
                        {t("adminEnroll")}
                      </button>
                      <button
                        className="outline-button"
                        onClick={() => setSelectedStudent(null)}
                      >
                        {t("adminCancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="primary-button"
                      onClick={() => setSelectedStudent(student)}
                    >
                      {t("adminAddToClass")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default AdminStudentManagement
