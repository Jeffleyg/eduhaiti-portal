function SchoolAnalytics({ analytics, schools }) {
  if (!analytics) {
    return <div className="surface-panel p-8 text-center text-brand-navy/60">Carregando análise...</div>
  }

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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-navy/10">
                <th className="text-left p-2 font-semibold text-brand-navy">Escola</th>
                <th className="text-right p-2 font-semibold text-brand-navy">Logins</th>
                <th className="text-right p-2 font-semibold text-brand-navy">Usuários</th>
                <th className="text-right p-2 font-semibold text-brand-navy">Alunos</th>
                <th className="text-right p-2 font-semibold text-brand-navy">Prof.</th>
                <th className="text-right p-2 font-semibold text-brand-navy">Turmas</th>
                <th className="text-right p-2 font-semibold text-brand-navy">Última Atividade</th>
              </tr>
            </thead>
            <tbody>
              {analytics.schoolsDetails.length > 0 ? analytics.schoolsDetails.map((school) => (
                <tr key={school.id} className="border-b border-brand-navy/5 hover:bg-sand/30">
                  <td className="p-2 font-medium text-brand-navy">{school.name}</td>
                  <td className="text-right p-2 text-blue-600">{school.logins}</td>
                  <td className="text-right p-2">{school.users}</td>
                  <td className="text-right p-2 text-emerald-600">{school.students}</td>
                  <td className="text-right p-2 text-purple-600">{school.teachers}</td>
                  <td className="text-right p-2 text-orange-600">{school.classes}</td>
                  <td className="text-right p-2 text-xs text-brand-navy/60">
                    {school.lastActivity
                      ? new Date(school.lastActivity).toLocaleDateString('pt-BR')
                      : '-'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="p-4 text-center text-brand-navy/60" colSpan={7}>
                    Sem dados de uso por escola ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default SchoolAnalytics
