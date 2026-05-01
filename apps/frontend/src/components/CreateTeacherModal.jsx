import { useTranslation } from "react-i18next"
import { useState } from "react"

function CreateTeacherModal({ onClose, onSubmit, loading, classes, teacherData, onChangeTeacher, onChangeTeacherClasses }) {
  const { t } = useTranslation()
  const [newClasses, setNewClasses] = useState([{ name: "", level: "" }])

  const classOptions = classes.map((item) => ({
    value: item.id,
    label: `${item.name} (${item.level})`,
  }))

  const handleNewClassChange = (index, field, value) => {
    setNewClasses((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    )
  }

  const addNewClassRow = () => {
    setNewClasses((prev) => [...prev, { name: "", level: "" }])
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const classesPayload = newClasses.filter((item) => item.name.trim().length > 0)
    const subjects = teacherData.subjects
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)

    onSubmit({
      ...teacherData,
      subjects,
      newClasses: classesPayload,
    })
    
    setNewClasses([{ name: "", level: "" }])
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          name="email"
          type="email"
          value={teacherData.email}
          onChange={onChangeTeacher}
          placeholder={t("email")}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          required
        />
        <input
          name="firstName"
          value={teacherData.firstName}
          onChange={onChangeTeacher}
          placeholder={t("firstName")}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          required
        />
        <input
          name="lastName"
          value={teacherData.lastName}
          onChange={onChangeTeacher}
          placeholder={t("lastName")}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          required
        />
        <input
          type="date"
          name="dateOfBirth"
          value={teacherData.dateOfBirth}
          onChange={onChangeTeacher}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          required
        />
        <input
          name="address"
          value={teacherData.address}
          onChange={onChangeTeacher}
          placeholder={t("address")}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          required
        />
        <select
          name="gender"
          value={teacherData.gender}
          onChange={onChangeTeacher}
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
          onChange={onChangeTeacher}
          placeholder={t("fatherName")}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
        />
        <input
          name="motherName"
          value={teacherData.motherName}
          onChange={onChangeTeacher}
          placeholder={t("motherName")}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
        />
        <input
          name="subjects"
          value={teacherData.subjects}
          onChange={onChangeTeacher}
          placeholder={t("subjects")}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-2"
        />
        <select
          multiple
          value={teacherData.classIds}
          onChange={onChangeTeacherClasses}
          className="min-h-[120px] rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-2"
        >
          {classOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div>
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
          <button
            className="outline-button text-sm"
            type="button"
            onClick={addNewClassRow}
          >
            {t("addClass")}
          </button>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          className="outline-button"
          disabled={loading}
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          className="primary-button"
          disabled={loading}
        >
          {loading ? t("loading") : t("createTeacherAction")}
        </button>
      </div>
    </form>
  )
}

export default CreateTeacherModal
