import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/api.js'
import { CreditCard, Users, Globe, Wifi, BookOpen, MessageSquare, Gamepad2, Package } from 'lucide-react'

function SchoolFeatures({ schoolId, token }) {
  const [features, setFeatures] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadFeatures()
  }, [schoolId, token])

  const loadFeatures = async () => {
    setLoading(true)
    try {
      const data = await apiFetch(`/owner/schools/${schoolId}/features`, { token })
      setFeatures(data || {})
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (key) => {
    if (!features) return
    const nextVal = !features[key]
    setSavingKey(key)

    try {
      const updated = await apiFetch(`/owner/schools/${schoolId}/features`, {
        method: 'PATCH',
        token,
        body: { [key]: nextVal },
      })
      setFeatures(updated)
    } catch (err) {
      setError(err.message || 'Falha ao atualizar módulo.')
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) {
    return <div className="text-xs text-brand-navy/60 p-4">Carregando permissões dos módulos...</div>
  }

  const modules = [
    {
      key: 'enableFinance',
      name: 'Módulo Financeiro',
      desc: 'Cobranças, controle de mensalidades e extratos.',
      icon: CreditCard,
      color: 'emerald',
    },
    {
      key: 'enableFamilyAccess',
      name: 'Espaço Família',
      desc: 'Visualização de boletins e canal com responsáveis.',
      icon: Users,
      color: 'sky',
    },
    {
      key: 'enablePayment',
      name: 'Pagamentos Online',
      desc: 'Integração direta com MonCash e Natcash.',
      icon: Globe,
      color: 'indigo',
    },
    {
      key: 'enableSync',
      name: 'Modo Offline (Survival)',
      desc: 'Permite lançar presenças e notas sem internet.',
      icon: Wifi,
      color: 'amber',
    },
    {
      key: 'enableLessons',
      name: 'Planos de Aulas',
      desc: 'Publicação de ementas e materiais pedagógicos.',
      icon: BookOpen,
      color: 'blue',
    },
    {
      key: 'enableForums',
      name: 'Fóruns da Escola',
      desc: 'Espaço de debates e dúvidas entre turmas.',
      icon: MessageSquare,
      color: 'purple',
    },
  ]

  return (
    <div className="space-y-3 bg-white p-5 rounded-2xl border border-brand-navy/10">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-brand-navy text-sm">Controle de Módulos da Escola</h4>
          <p className="text-xs text-brand-navy/60">
            Ative ou desative o que esta instituição pode acessar no portal.
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map(({ key, name, desc, icon: Icon, color }) => {
          const isActive = !!features[key]
          const isSaving = savingKey === key

          return (
            <div
              key={key}
              className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                isActive
                  ? 'bg-slate-50/80 border-slate-300'
                  : 'bg-white border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${isActive ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <strong className="text-xs font-bold text-brand-navy">{name}</strong>
                </div>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleToggle(key)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  {isSaving ? '...' : isActive ? 'Ativo' : 'Inativo'}
                </button>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">{desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default SchoolFeatures