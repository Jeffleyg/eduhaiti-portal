import { useTranslation } from "react-i18next"

function CreateStudentModal({ onClose, onSubmit, loading, classes, studentData, onChangeStudent }) {
  const { t } = useTranslation()

  const classOptions = classes.map((item) => ({
    value: item.id,
    label: `${item.name} (${item.level})`,
  }))

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          name="email"
          type="email"
          value={studentData.email}
          onChange={onChangeStudent}
          placeholder={t("email")}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          required
        />
        <input
          name="firstName"
          value={studentData.firstName}
          onChange={onChangeStudent}
          placeholder={t("firstName")}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          required
        />
        <input
          name="lastName"
          value={studentData.lastName}
          onChange={onChangeStudent}
          placeholder={t("lastName")}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          required
        />
        <input
          type="date"
          name="dateOfBirth"
          value={studentData.dateOfBirth}
          onChange={onChangeStudent}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          required
        />
        <input
          name="address"
          value={studentData.address}
          onChange={onChangeStudent}
          placeholder={t("address")}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          required
        />
        <select
          name="gender"
          value={studentData.gender}
          onChange={onChangeStudent}
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
          onChange={onChangeStudent}
          placeholder={t("fatherName")}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
        />
        <input
          name="motherName"
          value={studentData.motherName}
          onChange={onChangeStudent}
          placeholder={t("motherName")}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
        />
        <select
          name="classId"
          value={studentData.classId}
          onChange={onChangeStudent}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-2"
          required
        >
          <option value="">{t("selectClass")}</option>
          {classOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
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
          {loading ? t("loading") : t("createStudentAction")}
        </button>
      </div>
    </form>
  )
}

export default CreateStudentModal
