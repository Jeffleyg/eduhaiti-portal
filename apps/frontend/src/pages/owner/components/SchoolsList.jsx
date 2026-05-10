import { useState } from 'react'
import { apiFetch } from '../../../lib/api.js'
import SchoolFeatures from './SchoolFeatures.jsx'
import PermissionCodeManager from './PermissionCodeManager.jsx'

function SchoolsList({ schools, loading, onEdit, onDelete, token }) {
  const [expandedSchool, setExpandedSchool] = useState(null)

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-center text-brand-navy/60">Carregando escolas...</p>
      ) : schools.length === 0 ? (
        <p className="text-center text-brand-navy/60">Nenhuma escola cadastrada</p>
      ) : (
        schools.map((school) => (
          <div
            key={school.id}
            className="rounded-2xl border border-brand-navy/10 bg-white p-4 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between gap-4 md:flex-row flex-col">
              <div className="flex-1">
                <h3 className="font-semibold text-brand-navy text-lg">{school.name}</h3>
                <p className="text-sm text-brand-navy/60">{school.email}</p>
                <p className="text-xs text-brand-navy/50 mt-1">
                  {school.city && `${school.city}, `}
                  {school.country}
                </p>
                {school.usageAnalytics && (
                  <div className="mt-2 flex gap-4 text-xs text-brand-navy/70">
                    <span>👥 {school.usageAnalytics.totalUsers} usuários</span>
                    <span>📚 {school.usageAnalytics.classCount} turmas</span>
                    <span>✅ {school.usageAnalytics.attendanceRecords} presenças</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setExpandedSchool(expandedSchool === school.id ? null : school.id)}
                  className="rounded-lg bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600"
                >
                  {expandedSchool === school.id ? 'Recolher' : 'Detalhes'}
                </button>
                <button
                  onClick={() => onEdit(school)}
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-sm text-white hover:bg-emerald-600"
                >
                  Editar
                </button>
                <button
                  onClick={() => onDelete(school.id)}
                  className="rounded-lg bg-brand-red px-3 py-2 text-sm text-white hover:bg-brand-red/90"
                >
                  Deletar
                </button>
              </div>
            </div>

            {/* Expandable Details */}
            {expandedSchool === school.id && (
              <div className="mt-4 space-y-4 border-t border-brand-navy/10 pt-4">
                <SchoolFeatures schoolId={school.id} token={token} />
                <PermissionCodeManager schoolId={school.id} token={token} />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

export default SchoolsList
