import { useEffect, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { sanitizeText, maskName } from "../../lib/string.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import SkeletonLoader from "../../components/SkeletonLoader.jsx"
import LoadingState from "../../components/LoadingState.jsx"
import LoadMoreList from "../../components/LoadMoreList.jsx"

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
  const [searchName, setSearchName] = useState("")
  const [filterClassId, setFilterClassId] = useState("")
  const [filterEnrollmentStatus, setFilterEnrollmentStatus] = useState("")

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

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesName =
        student.name?.toLowerCase().includes(searchName.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchName.toLowerCase())

      const matchesClass =
        !filterClassId ||
        student.classesAttending?.some((cls) => cls.id === filterClassId)

      const matchesEnrollment =
        filterEnrollmentStatus === "" ||
        (filterEnrollmentStatus === "enrolled" && student.classesAttending?.length > 0) ||
        (filterEnrollmentStatus === "not-enrolled" && !student.classesAttending?.length)

      return matchesName && matchesClass && matchesEnrollment
    })
  }, [students, searchName, filterClassId, filterEnrollmentStatus])

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("adminStudentManagementTitle")}
        subtitle={t("adminStudentManagementSubtitle")}
      />

      {error ? <LoadingState error={error} type="banner" message={error} /> : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-brand-navy">{t("adminStudentList")}</h3>
            <p className="mt-1 text-xs text-brand-navy/60">
              {t("total")}: {filteredStudents.length} de {students.length}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            placeholder={t("searchByNameEmail")}
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          />
          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          >
            <option value="">{t("allClasses")}</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} ({cls.level})
              </option>
            ))}
          </select>
          <select
            value={filterEnrollmentStatus}
            onChange={(e) => setFilterEnrollmentStatus(e.target.value)}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          >
            <option value="">{t("allStatuses")}</option>
            <option value="enrolled">{t("enrolled")}</option>
            <option value="not-enrolled">{t("notEnrolled")}</option>
          </select>
          <button
            onClick={() => {
              setSearchName("")
              setFilterClassId("")
              setFilterEnrollmentStatus("")
            }}
            className="outline-button"
          >
            {t("clearFilters")}
          </button>
        </div>

        {loading ? (
          <div className="mt-4">
            <SkeletonLoader type="list" count={3} />
          </div>
        ) : filteredStudents.length === 0 ? (
          <p className="mt-4 text-sm text-brand-navy/60">{t("noData")}</p>
        ) : (
          <LoadMoreList
            items={filteredStudents}
            initialLimit={6}
            step={6}
            renderItem={(student) => (
              <div key={student.id} className="module-card compact card-compact">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-brand-navy">{maskName(student.name, "student")}</p>
                      <span className={`badge ${
                        student.classesAttending?.length > 0
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-brand-navy/10 text-brand-navy/70"
                      }`}>
                        {student.classesAttending?.length > 0 ? t("enrolled") : t("notEnrolled")}
                      </span>
                    </div>
                    <p className="text-xs text-brand-navy/60">{sanitizeText(student.email)}</p>
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
            )}
          />
        )}
      </section>
    </div>
  )
}

export default AdminStudentManagement
