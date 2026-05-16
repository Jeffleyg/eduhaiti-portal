import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext.jsx'
import { apiFetch } from '../../lib/api.js'
import SectionHeader from '../../components/SectionHeader.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import SchoolsList from './components/SchoolsList.jsx'
import SchoolForm from './components/SchoolForm.jsx'
import SchoolAnalytics from './components/SchoolAnalytics.jsx'

function OwnerDashboard() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [schools, setSchools] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedSchool, setSelectedSchool] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [accessLink, setAccessLink] = useState('')
  const [activeTab, setActiveTab] = useState('schools')

  const loadSchools = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/owner/schools', { token })
      setSchools(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/owner/analytics/summary', { token })
      setAnalytics(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSchools()
    loadAnalytics()
  }, [])

  const handleCreateSchool = (result) => {
    const schoolName = result?.school?.name || t('newSchool')
    setMessage(`${t('schoolCreatedSuccess')}: ${schoolName}`)
    setAccessLink(result?.accessLink || '')
    setShowForm(false)
    loadSchools()
  }

  const handleUpdateSchool = (result) => {
    const schoolName = result?.school?.name || t('school')
    setMessage(`${t('schoolUpdatedSuccess')}: ${schoolName}`)
    setAccessLink('')
    setSelectedSchool(null)
    loadSchools()
  }

  const openCreateForm = () => {
    setSelectedSchool(null)
    setShowForm(true)
  }

  const openEditForm = (school) => {
    setSelectedSchool(school)
    setShowForm(true)
    setActiveTab('schools')
  }

  const handleDeleteSchool = async (schoolId) => {
    if (!window.confirm(t("confirmDeleteSchool"))) return

    try {
      await apiFetch(`/owner/schools/${schoolId}`, {
        method: 'DELETE',
        token,
      })
      setMessage(t("schoolDeletedSuccess"))
      loadSchools()
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const clearMessages = () => {
    setError('')
    setMessage('')
    setAccessLink('')
  }

  const totalSchools = schools.length
  const schoolsWithAnalytics = schools.filter((school) => school.usageAnalytics).length
  const totalUsers = analytics?.totalUsers ?? 0
  const totalLogins = analytics?.totalLogins ?? 0

  return (
    <div className="flex gap-6">
      <Sidebar role="owner" />
      <main className="flex-1 space-y-6">
        <section className="surface-panel overflow-hidden">
          <div className="bg-atlas bg-grid px-5 py-6 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <span className="chip">{t("controlPanel")}</span>
                <h1 className="font-display text-3xl text-brand-navy sm:text-4xl">{t("centralManagementEcosystem")}</h1>
                <p className="max-w-xl text-sm leading-6 text-brand-navy/70 sm:text-base">
                  {t("centralManagementDescription")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[420px]">
                {[
                  [t("schools"), totalSchools],
                  [t("withMetrics"), schoolsWithAnalytics],
                  [t("users"), totalUsers],
                  [t("logins"), totalLogins],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/50 bg-white/85 px-4 py-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy/50">{label}</p>
                    <p className="mt-1 text-2xl font-semibold text-brand-navy">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-brand-red/20 bg-brand-red/5 px-4 py-3 text-sm text-brand-red">
            <button onClick={clearMessages} className="float-right">
              ✕
            </button>
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
            <button onClick={clearMessages} className="float-right">
              ✕
            </button>
            <p>{message}</p>
            {accessLink ? (
              <p className="mt-2">
                Link de acesso inicial: <a className="font-semibold underline" href={accessLink} target="_blank" rel="noreferrer">abrir acesso</a>
              </p>
            ) : null}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-3 border-b border-brand-navy/10">
          <button
            onClick={() => setActiveTab('schools')}
            className={`px-4 py-3 font-semibold transition-colors ${
              activeTab === 'schools'
                ? 'border-b-2 border-brand-navy text-brand-navy'
                : 'text-brand-navy/60 hover:text-brand-navy'
            }`}
          >
            {t("schools")} ({schools.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-3 font-semibold transition-colors ${
              activeTab === 'analytics'
                ? 'border-b-2 border-brand-navy text-brand-navy'
                : 'text-brand-navy/60 hover:text-brand-navy'
            }`}
          >
            {t("usageAnalysis")}
          </button>
        </div>

        {/* Schools Tab */}
        {activeTab === 'schools' && (
          <div className="space-y-6">
            <button
              onClick={() => {
                if (showForm && !selectedSchool) {
                  setShowForm(false)
                  return
                }

                openCreateForm()
              }}
              className="rounded-2xl bg-brand-red px-6 py-2 text-sm font-semibold text-white hover:bg-brand-red/90 transition-colors"
            >
              {showForm ? t("cancel") : `+ ${t("newSchool")}`}
            </button>

            {showForm && (
              <SchoolForm
                school={selectedSchool}
                onSuccess={selectedSchool ? handleUpdateSchool : handleCreateSchool}
                onCancel={() => {
                  setShowForm(false)
                  setSelectedSchool(null)
                }}
                token={token}
              />
            )}

            <SchoolsList
              schools={schools}
              loading={loading}
              onEdit={openEditForm}
              onDelete={handleDeleteSchool}
              token={token}
            />
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && <SchoolAnalytics analytics={analytics} schools={schools} />}
      </main>
    </div>
  )
}

export default OwnerDashboard
