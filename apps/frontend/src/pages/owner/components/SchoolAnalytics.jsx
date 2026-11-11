import { uiLocale } from "../../../lib/locale.js"
import { useTranslation } from "react-i18next"
import DataTablePaginated from "../../../components/DataTablePaginated.jsx"
import SkeletonLoader from "../../../components/SkeletonLoader.jsx"
import { sanitizeText } from "../../../lib/string.js"

function SchoolAnalytics({ analytics }) {
  const { t } = useTranslation()
  if (!analytics) {
    return (
      <div className="space-y-6">
        <SkeletonLoader type="dashboard" />
        <SkeletonLoader type="table" count={5} />
      </div>
    )
  }

  const schoolRows = (analytics.schoolsDetails ?? []).map((school) => ({
    id: school.id,
    school: sanitizeText(school.name),
    logins: school.logins,
    users: school.users,
    students: school.students,
    teachers: school.teachers,
    classes: school.classes,
    lastActivity: school.lastActivity ? new Date(school.lastActivity).toLocaleDateString(uiLocale()) : "-",
  }))

  const schoolColumns = [
    { key: "school", label: t("school") },
    { key: "logins", label: t("logins") },
    { key: "users", label: t("users") },
    { key: "students", label: t("students") },
    { key: "teachers", label: t("teachersShort") },
    { key: "classes", label: t("classesLabel") },
    { key: "lastActivity", label: t("lastActivity") },
  ]

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="surface-panel p-4 text-center">
          <p className="text-3xl font-bold text-brand-navy">{analytics.totalSchools}</p>
          <p className="text-sm text-brand-navy/60">{t("schools")}</p>
        </div>
        <div className="surface-panel p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{analytics.totalUsers}</p>
          <p className="text-sm text-brand-navy/60">{t("users")}</p>
        </div>
        <div className="surface-panel p-4 text-center">
          <p className="text-3xl font-bold text-emerald-600">{analytics.totalLogins}</p>
          <p className="text-sm text-brand-navy/60">{t("logins")}</p>
        </div>
        <div className="surface-panel p-4 text-center">
          <p className="text-3xl font-bold text-purple-600">{analytics.totalGrades}</p>
          <p className="text-sm text-brand-navy/60">{t("navGrades")}</p>
        </div>
        <div className="surface-panel p-4 text-center">
          <p className="text-3xl font-bold text-orange-600">{analytics.totalAttendance}</p>
          <p className="text-sm text-brand-navy/60">{t("attendanceTitle")}</p>
        </div>
      </div>

      {/* Schools Usage Table */}
      <div className="surface-panel p-6">
        <h3 className="mb-4 font-semibold text-brand-navy">{t("usageBySchool")}</h3>
        <DataTablePaginated
          columns={schoolColumns}
          rows={schoolRows}
          pageSize={10}
          totalCount={schoolRows.length}
          emptyMessage={t("usageBySchoolEmpty")}
        />
      </div>
    </div>
  )
}

export default SchoolAnalytics
