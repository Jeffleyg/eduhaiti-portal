import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { apiFetch } from "../../lib/api.js"
import { useAuth } from "../../context/AuthContext.jsx"

const emptyStudent = {
  email: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  address: "",
  gender: "",
  fatherName: "",
  motherName: "",
  classId: "",
}

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
  const [studentData, setStudentData] = useState(emptyStudent)
  const [teacherData, setTeacherData] = useState(emptyTeacher)
  const [newClasses, setNewClasses] = useState([{ name: "", level: "" }])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

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

  const classOptions = useMemo(
    () =>
      classes.map((item) => ({
        value: item.id,
        label: `${item.name} (${item.level})`,
      })),
    [classes],
  )

  const handleStudentChange = (event) => {
    const { name, value } = event.target
    setStudentData((prev) => ({ ...prev, [name]: value }))
  }

  const handleTeacherChange = (event) => {
    const { name, value } = event.target
    setTeacherData((prev) => ({ ...prev, [name]: value }))
  }

  const handleTeacherClasses = (event) => {
    const selected = Array.from(event.target.selectedOptions).map((option) => option.value)
    setTeacherData((prev) => ({ ...prev, classIds: selected }))
  }

  const handleNewClassChange = (index, field, value) => {
    setNewClasses((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    )
  }

  const addNewClassRow = () => {
    setNewClasses((prev) => [...prev, { name: "", level: "" }])
  }

  const submitStudent = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await apiFetch("/admin/users/students", {
        method: "POST",
        token,
        body: studentData,
      })
      setMessage(t("studentCreated"))
      setStudentData(emptyStudent)
      await refreshUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const submitTeacher = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    const subjects = teacherData.subjects
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)

    const classesPayload = newClasses.filter((item) => item.name.trim().length > 0)

    try {
      await apiFetch("/admin/users/teachers", {
        method: "POST",
        token,
        body: {
          ...teacherData,
          subjects,
          newClasses: classesPayload,
        },
      })
      setMessage(t("teacherCreated"))
      setTeacherData(emptyTeacher)
      setNewClasses([{ name: "", level: "" }])
      await refreshUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl text-brand-navy">{t("adminUsersTitle")}</h1>
        <p className="mt-2 text-sm text-brand-navy/70">{t("adminUsersSubtitle")}</p>
      </header>

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h2 className="text-lg font-semibold text-brand-navy">{t("createStudentTitle")}</h2>
        <form onSubmit={submitStudent} className="mt-4 grid gap-4 md:grid-cols-2">
          <input
            name="email"
            value={studentData.email}
            onChange={handleStudentChange}
            placeholder={t("email")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <input
            name="firstName"
            value={studentData.firstName}
            onChange={handleStudentChange}
            placeholder={t("firstName")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <input
            name="lastName"
            value={studentData.lastName}
            onChange={handleStudentChange}
            placeholder={t("lastName")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <input
            type="date"
            name="dateOfBirth"
            value={studentData.dateOfBirth}
            onChange={handleStudentChange}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <input
            name="address"
            value={studentData.address}
            onChange={handleStudentChange}
            placeholder={t("address")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <select
            name="gender"
            value={studentData.gender}
            onChange={handleStudentChange}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          >
            <option value="">{t("gender")}</option>
            <option value="MALE">{t("genderMale")}</option>
            <option value="FEMALE">{t("genderFemale")}</option>
            <option value="OTHER">{t("genderOther")}</option>
          </select>
          <input
            name="fatherName"
            value={studentData.fatherName}
            onChange={handleStudentChange}
            placeholder={t("fatherName")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          />
          <input
            name="motherName"
            value={studentData.motherName}
            onChange={handleStudentChange}
            placeholder={t("motherName")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          />
          <select
            name="classId"
            value={studentData.classId}
            onChange={handleStudentChange}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-2"
          >
            <option value="">{t("selectClass")}</option>
            {classOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button className="primary-button md:col-span-2" type="submit" disabled={loading}>
            {loading ? t("loading") : t("createStudentAction")}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h2 className="text-lg font-semibold text-brand-navy">{t("createTeacherTitle")}</h2>
        <form onSubmit={submitTeacher} className="mt-4 grid gap-4 md:grid-cols-2">
          <input
            name="email"
            value={teacherData.email}
            onChange={handleTeacherChange}
            placeholder={t("email")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <input
            name="firstName"
            value={teacherData.firstName}
            onChange={handleTeacherChange}
            placeholder={t("firstName")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <input
            name="lastName"
            value={teacherData.lastName}
            onChange={handleTeacherChange}
            placeholder={t("lastName")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <input
            type="date"
            name="dateOfBirth"
            value={teacherData.dateOfBirth}
            onChange={handleTeacherChange}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <input
            name="address"
            value={teacherData.address}
            onChange={handleTeacherChange}
            placeholder={t("address")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <select
            name="gender"
            value={teacherData.gender}
            onChange={handleTeacherChange}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          >
            <option value="">{t("gender")}</option>
            <option value="MALE">{t("genderMale")}</option>
            <option value="FEMALE">{t("genderFemale")}</option>
            <option value="OTHER">{t("genderOther")}</option>
          </select>
          <input
            name="fatherName"
            value={teacherData.fatherName}
            onChange={handleTeacherChange}
            placeholder={t("fatherName")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          />
          <input
            name="motherName"
            value={teacherData.motherName}
            onChange={handleTeacherChange}
            placeholder={t("motherName")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          />
          <input
            name="subjects"
            value={teacherData.subjects}
            onChange={handleTeacherChange}
            placeholder={t("subjects")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-2"
          />
          <select
            multiple
            value={teacherData.classIds}
            onChange={handleTeacherClasses}
            className="min-h-[120px] rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-2"
          >
            {classOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <div className="md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
              {t("newClasses")}
            </p>
            <div className="mt-3 space-y-2">
              {newClasses.map((item, index) => (
                <div key={`class-${index}`} className="grid gap-2 md:grid-cols-2">
                  <input
                    value={item.name}
                    onChange={(event) => handleNewClassChange(index, "name", event.target.value)}
                    placeholder={t("className")}
                    className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                  />
                  <input
                    value={item.level}
                    onChange={(event) => handleNewClassChange(index, "level", event.target.value)}
                    placeholder={t("classLevel")}
                    className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <button className="outline-button" type="button" onClick={addNewClassRow}>
                {t("addClass")}
              </button>
            </div>
          </div>

          <button className="primary-button md:col-span-2" type="submit" disabled={loading}>
            {loading ? t("loading") : t("createTeacherAction")}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h2 className="text-lg font-semibold text-brand-navy">Alunos cadastrados</h2>
        {students.length === 0 ? (
          <p className="mt-3 text-sm text-brand-navy/60">Nenhum aluno cadastrado.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {students.map((student) => (
              <div key={student.id} className="rounded-2xl border border-brand-navy/10 bg-white p-3 text-sm">
                <p className="font-semibold text-brand-navy">
                  {student.name} ({student.enrollmentNumber || "-"})
                </p>
                <p className="text-brand-navy/70">Email: {student.email}</p>
                <p className="text-brand-navy/70">
                  Parentes: {student.fatherName || "-"} / {student.motherName || "-"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h2 className="text-lg font-semibold text-brand-navy">Professores cadastrados</h2>
        {teachers.length === 0 ? (
          <p className="mt-3 text-sm text-brand-navy/60">Nenhum professor cadastrado.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {teachers.map((teacher) => (
              <div key={teacher.id} className="rounded-2xl border border-brand-navy/10 bg-white p-3 text-sm">
                <p className="font-semibold text-brand-navy">
                  {teacher.name} ({teacher.enrollmentNumber || "-"})
                </p>
                <p className="text-brand-navy/70">Email: {teacher.email}</p>
                <p className="text-brand-navy/70">
                  Disciplinas: {(teacher.subjects ?? []).length ? teacher.subjects.join(", ") : "-"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default AdminUsers
