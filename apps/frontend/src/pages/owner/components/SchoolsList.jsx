import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../../lib/api.js'
import { sanitizeText } from '../../../lib/string.js'
import SchoolFeatures from './SchoolFeatures.jsx'
import PermissionCodeManager from './PermissionCodeManager.jsx'

function SchoolsList({ schools, loading, onEdit, onDelete, token }) {
  const { t } = useTranslation()
  const [expandedSchool, setExpandedSchool] = useState(null)

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="surface-panel p-8 text-center text-brand-navy/60">
          {t("loadingSchools")}
        </div>
      ) : schools.length === 0 ? (
        <div className="surface-panel p-8 text-center">
          <p className="text-lg font-semibold text-brand-navy">{t("noSchoolsRegistered")}</p>
          <p className="mt-2 text-sm text-brand-navy/60">
            {t("useNewSchoolButtonToCreate")}
          </p>
        </div>
      ) : (
        schools.map((school) => (
          <div
            key={school.id}
            className="surface-panel p-4 transition-all hover:-translate-y-0.5 hover:shadow-2xl"
          >
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-brand-navy">{sanitizeText(school.name)}</h3>
                  <span className="chip">{sanitizeText(school.country)}</span>
                </div>
                <p className="text-sm text-brand-navy/60">{sanitizeText(school.email)}</p>
                <p className="text-xs text-brand-navy/50 mt-1">
                  {school.city && `${sanitizeText(school.city)}, `}
                  {sanitizeText(school.country)}
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
                  className="rounded-lg bg-brand-navy px-3 py-2 text-sm text-white transition-colors hover:bg-brand-navy/90"
                >
                  {expandedSchool === school.id ? t("collapse") : t("details")}
                </button>
                <button
                  onClick={() => onEdit(school)}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white transition-colors hover:bg-emerald-700"
                >
                  {t("editAction")}
                </button>
                <button
                  onClick={() => onDelete(school.id)}
                  className="rounded-lg bg-brand-red px-3 py-2 text-sm text-white transition-colors hover:bg-brand-red/90"
                >
                  {t("deleteAction")}
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
