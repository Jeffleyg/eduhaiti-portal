import DataTablePaginated from "../../../components/DataTablePaginated.jsx"
import SkeletonLoader from "../../../components/SkeletonLoader.jsx"
import { sanitizeText } from "../../../lib/string.js"

function SchoolAnalytics({ analytics, schools }) {
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
    lastActivity: school.lastActivity ? new Date(school.lastActivity).toLocaleDateString("pt-BR") : "-",
  }))

  const schoolColumns = [
    { key: "school", label: "Escola" },
    { key: "logins", label: "Logins" },
    { key: "users", label: "Usuários" },
    { key: "students", label: "Alunos" },
    { key: "teachers", label: "Prof." },
    { key: "classes", label: "Turmas" },
    { key: "lastActivity", label: "Última Atividade" },
  ]

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="surface-panel p-4 text-center">
          <p className="text-3xl font-bold text-brand-navy">{analytics.totalSchools}</p>
          <p className="text-sm text-brand-navy/60">Escolas</p>
        </div>
        <div className="surface-panel p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{analytics.totalUsers}</p>
          <p className="text-sm text-brand-navy/60">Usuários</p>
        </div>
        <div className="surface-panel p-4 text-center">
          <p className="text-3xl font-bold text-emerald-600">{analytics.totalLogins}</p>
          <p className="text-sm text-brand-navy/60">Logins</p>
        </div>
        <div className="surface-panel p-4 text-center">
          <p className="text-3xl font-bold text-purple-600">{analytics.totalGrades}</p>
          <p className="text-sm text-brand-navy/60">Notas</p>
        </div>
        <div className="surface-panel p-4 text-center">
          <p className="text-3xl font-bold text-orange-600">{analytics.totalAttendance}</p>
          <p className="text-sm text-brand-navy/60">Presenças</p>
        </div>
      </div>

      {/* Schools Usage Table */}
      <div className="surface-panel p-6">
        <h3 className="mb-4 font-semibold text-brand-navy">Uso por Escola</h3>
        <DataTablePaginated
          columns={schoolColumns}
          rows={schoolRows}
          pageSize={10}
          totalCount={schoolRows.length}
          emptyMessage="Sem dados de uso por escola ainda."
        />
      </div>
    </div>
  )
}

export default SchoolAnalytics
