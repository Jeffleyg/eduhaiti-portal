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

  const handleCreateSchool = (schoolData) => {
    setMessage('Escola criada com sucesso')
    setShowForm(false)
    loadSchools()
    setTimeout(() => setMessage(''), 3000)
  }

  const handleUpdateSchool = (schoolData) => {
    setMessage('Escola atualizada com sucesso')
    setSelectedSchool(null)
    loadSchools()
    setTimeout(() => setMessage(''), 3000)
  }

  const handleDeleteSchool = async (schoolId) => {
    if (!window.confirm('Tem certeza que deseja deletar esta escola?')) return

    try {
      await apiFetch(`/owner/schools/${schoolId}`, {
        method: 'DELETE',
        token,
      })
      setMessage('Escola deletada com sucesso')
      loadSchools()
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const clearMessages = () => {
    setError('')
    setMessage('')
  }

  return (
    <div className="flex gap-6">
      <Sidebar role="owner" />
      <main className="flex-1 space-y-6">
        <SectionHeader
          title="Painel de Controle - Dono do Sistema"
          subtitle="Gerencie escolas, recursos e permissões"
        />

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
            {message}
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
            Escolas ({schools.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-3 font-semibold transition-colors ${
              activeTab === 'analytics'
                ? 'border-b-2 border-brand-navy text-brand-navy'
                : 'text-brand-navy/60 hover:text-brand-navy'
            }`}
          >
            Análise de Uso
          </button>
        </div>

        {/* Schools Tab */}
        {activeTab === 'schools' && (
          <div className="space-y-6">
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-2xl bg-brand-red px-6 py-2 text-sm font-semibold text-white hover:bg-brand-red/90 transition-colors"
            >
              {showForm ? 'Cancelar' : '+ Nova Escola'}
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
              onEdit={(school) => {
                setSelectedSchool(school)
                setShowForm(true)
                setActiveTab('schools')
              }}
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
