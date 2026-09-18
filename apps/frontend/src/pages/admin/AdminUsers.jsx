import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { apiFetch } from "../../lib/api.js"
import { useAuth } from "../../context/AuthContext.jsx"
import Modal from "../../components/Modal.jsx"
import CreateStudentModal from "../../components/CreateStudentModal.jsx"
import CreateTeacherModal from "../../components/CreateTeacherModal.jsx"
import SkeletonLoader from "../../components/SkeletonLoader.jsx"
import LoadingState from "../../components/LoadingState.jsx"
import LoadMoreList from "../../components/LoadMoreList.jsx"
import ListItemCard from "../../components/ListItemCard.jsx"
import { GraduationCap, Users } from "lucide-react"
import AdminSectionToolbar from "../../components/AdminSectionToolbar.jsx"
import { sanitizeText, maskName } from "../../lib/string.js"

const emptyTeacher = {
  email: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  address: "",
  gender: "",
  fatherName: "",
  motherName: "",
  subjects: "",
  classIds: [],
}

function AdminUsers() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [teacherData, setTeacherData] = useState(emptyTeacher)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [showCreateStudent, setShowCreateStudent] = useState(false)
  const [showCreateTeacher, setShowCreateTeacher] = useState(false)
  const [activeSection, setActiveSection] = useState("students")

  useEffect(() => {
    const loadData = async () => {
      try {
        const [classesData, studentsData, teachersData] = await Promise.all([
          apiFetch("/admin/classes", { token }),
          apiFetch("/admin/users/students", { token }),
          apiFetch("/admin/users/teachers", { token }),
        ])
        setClasses(classesData ?? [])
        setStudents(studentsData ?? [])
        setTeachers(teachersData ?? [])
      } catch (err) {
        setError(err.message)
      }
    }

    if (token) {
      loadData()
    }
  }, [token])

  const refreshUsers = async () => {
    const [studentsData, teachersData] = await Promise.all([
      apiFetch("/admin/users/students", { token }),
      apiFetch("/admin/users/teachers", { token }),
    ])
    setStudents(studentsData ?? [])
    setTeachers(teachersData ?? [])
  }

  const handleTeacherChange = (event) => {
    const { name, value } = event.target
    setTeacherData((prev) => ({ ...prev, [name]: value }))
  }

  const handleTeacherClasses = (event) => {
    const selected = Array.from(event.target.selectedOptions).map((option) => option.value)
    setTeacherData((prev) => ({ ...prev, classIds: selected }))
  }

  const submitStudent = async (formData) => {
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await apiFetch("/admin/users/students", {
        method: "POST",
        token,
        body: formData,
      })
      setShowCreateStudent(false)
      setMessage(t("studentCreated"))
      await refreshUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const submitTeacher = async (teacherPayload) => {
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await apiFetch("/admin/users/teachers", {
        method: "POST",
        token,
        body: teacherPayload,
      })
      setMessage(t("teacherCreated"))
      setTeacherData(emptyTeacher)
      setShowCreateTeacher(false)
      await refreshUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-brand-navy">{t("adminUsersTitle")}</h1>
        <p className="mt-2 text-sm text-brand-navy/70">{t("adminUsersSubtitle")}</p>
      </header>

      {error ? <LoadingState error={error} type="banner" message={error} /> : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <AdminSectionToolbar
          sections={[{ key: "students", label: t("students") }, { key: "teachers", label: t("teachers") }]}
          active={activeSection}
          onChange={(k) => setActiveSection(k)}
        />
        <div className="ml-4 flex gap-2">
          <button
            onClick={() => {
              setShowCreateStudent(true)
              setError("")
              setMessage("")
            }}
            className="primary-button flex items-center justify-center gap-2"
          >
            <span className="text-lg">+</span>
            {t("createStudentTitle")}
          </button>
          <button
            onClick={() => {
              setShowCreateTeacher(true)
              setError("")
              setMessage("")
            }}
            className="primary-button flex items-center justify-center gap-2"
          >
            <span className="text-lg">+</span>
            {t("createTeacherTitle")}
          </button>
        </div>
      </div>

      <Modal
        isOpen={showCreateStudent}
        onClose={() => {
          setShowCreateStudent(false)
          setError("")
        }}
        title={t("createStudentTitle")}
      >
        <CreateStudentModal
          onClose={() => {
            setShowCreateStudent(false)
          }}
          onSubmit={submitStudent}
          loading={loading}
          classes={classes}
        />
      </Modal>

      <Modal
        isOpen={showCreateTeacher}
        onClose={() => {
          setShowCreateTeacher(false)
          setTeacherData(emptyTeacher)
          setError("")
        }}
        title={t("createTeacherTitle")}
        size="lg"
      >
        <CreateTeacherModal
          isOpen={showCreateTeacher}
          onClose={() => {
            setShowCreateTeacher(false)
            setTeacherData(emptyTeacher)
          }}
          onSubmit={submitTeacher}
          loading={loading}
          classes={classes}
          teacherData={teacherData}
          onChangeTeacher={handleTeacherChange}
          onChangeTeacherClasses={handleTeacherClasses}
        />
      </Modal>

      {activeSection === "students" && (
        <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-navy">{t("students")}</h2>
          <span className="inline-block rounded-full bg-brand-navy/10 px-3 py-1 text-xs font-semibold text-brand-navy">
            {students.length}
          </span>
        </div>
        {students.length === 0 ? (
          <p className="mt-3 text-sm text-brand-navy/60">{t("noData")}</p>
        ) : (
          <LoadMoreList
            items={students}
            initialLimit={6}
            step={6}
            renderItem={(student) => (
                <ListItemCard
                id={student.id}
                icon={<Users className="h-5 w-5 text-brand-sky" />}
                title={maskName(student.name, "student")}
                subtitle={sanitizeText(student.email)}
                status={student.classesAttending?.length > 0 ? t("enrolled") : t("notEnrolled")}
                statusColor={student.classesAttending?.length > 0 ? "green" : "yellow"}
                preview={
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-brand-navy/60">{t("adminStudentEnrollmentNumber")}</p>
                      <p className="font-semibold text-brand-navy">{student.enrollmentNumber || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-navy/60">{t("classes")}</p>
                      <p className="font-semibold text-brand-navy">{student.classesAttending?.length ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-navy/60">{t("guardians")}</p>
                      <p className="font-semibold text-brand-navy">{student.fatherName || student.motherName ? t("withData") : "-"}</p>
                    </div>
                  </div>
                }
              />
            )}
          />
        )}
        </section>
      )}

      {activeSection === "teachers" && (
        <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-navy">{t("teachers")}</h2>
          <span className="inline-block rounded-full bg-brand-navy/10 px-3 py-1 text-xs font-semibold text-brand-navy">
            {teachers.length}
          </span>
        </div>
        {teachers.length === 0 ? (
          <p className="mt-3 text-sm text-brand-navy/60">{t("noData")}</p>
        ) : (
          <LoadMoreList
            items={teachers}
            initialLimit={6}
            step={6}
            renderItem={(teacher) => (
                <ListItemCard
                id={teacher.id}
                icon={<GraduationCap className="h-5 w-5 text-brand-red" />}
                title={maskName(teacher.name, "teacher")}
                subtitle={sanitizeText(teacher.email)}
                status={t("teacher")}
                statusColor="blue"
                preview={
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-brand-navy/60">{t("adminStudentEnrollmentNumber")}</p>
                      <p className="font-semibold text-brand-navy">{teacher.enrollmentNumber || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-navy/60">{t("classes")}</p>
                      <p className="font-semibold text-brand-navy">{teacher.classesTeaching?.length ?? teacher.classIds?.length ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-navy/60">{t("subjects")}</p>
                      <p className="font-semibold text-brand-navy">{(teacher.subjects ?? []).length ? teacher.subjects.join(", ") : "-"}</p>
                    </div>
                  </div>
                }
              />
            )}
          />
        )}
        </section>
      )}
    </div>
  )
}

export default AdminUsers
