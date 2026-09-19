import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../../lib/api.js'
import { Building2, ShieldCheck, Lock, CreditCard, Users, Globe, Wifi } from 'lucide-react'

const initialFormState = {
  name: '',
  email: '',
  phone: '',
  address: '',
  city: 'Port-au-Prince',
  country: 'Haiti',
  principal: '',
  // Administrador Inicial da Escola
  adminName: '',
  adminEmail: '',
  adminPassword: 'Password@123',
  // Módulos
  enableFinance: true,
  enableFamilyAccess: true,
  enablePayment: true,
  enableSync: true,
  enableLessons: true,
}

function SchoolForm({ school, onSuccess, onCancel, token }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(initialFormState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (school) {
      setForm({
        name: school.name ?? '',
        email: school.email ?? '',
        phone: school.phone ?? '',
        address: school.address ?? '',
        city: school.city ?? 'Port-au-Prince',
        country: school.country ?? 'Haiti',
        principal: school.principal ?? '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        enableFinance: school.enableFinance ?? true,
        enableFamilyAccess: school.enableFamilyAccess ?? true,
        enablePayment: school.enablePayment ?? true,
        enableSync: school.enableSync ?? true,
        enableLessons: school.enableLessons ?? true,
      })
      return
    }
    setForm(initialFormState)
  }, [school])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || 'Port-au-Prince',
      country: form.country.trim() || 'Haiti',
      principal: form.principal.trim(),
      enableFinance: form.enableFinance,
      enableFamilyAccess: form.enableFamilyAccess,
      enablePayment: form.enablePayment,
      enableSync: form.enableSync,
      enableLessons: form.enableLessons,
      ...(school ? {} : {
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim(),
        adminPassword: form.adminPassword,
      }),
    }

    try {
      let response
      if (school) {
        response = await apiFetch(`/owner/schools/${school.id}`, {
          method: 'PATCH',
          token,
          body: payload,
        })
        onSuccess?.({ school: response?.school ?? { ...school, ...payload } })
      } else {
        response = await apiFetch('/owner/schools', {
          method: 'POST',
          token,
          body: payload,
        })
        const createdSchool = response?.school ?? response
        onSuccess?.({ school: createdSchool })
      }
    } catch (err) {
      setError(err.message || 'Falha ao salvar escola.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-3xl border border-brand-navy/10 bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-brand-navy/10">
        <div className="p-2.5 rounded-2xl bg-brand-navy text-white">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-brand-navy">
            {school ? t("editSchool", "Editar Escola") : t("createNewSchool", "Cadastrar Nova Escola")}
          </h3>
          <p className="text-xs text-brand-navy/60">
            {school
              ? "Atualize as informações institucionais e permissões dos módulos."
              : "Preencha os dados oficiais, provisione o administrador e defina os módulos ativos."}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bloco 1: Dados da Instituição */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-navy mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            1. Dados da Instituição
          </h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-brand-navy uppercase mb-1">
                Nome da Escola *
              </label>
              <input
                type="text"
                placeholder="Ex: EduHaiti Academy"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-navy uppercase mb-1">
                E-mail Institucional *
              </label>
              <input
                type="email"
                placeholder="contact@ecole.ht"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-navy uppercase mb-1">
                Telefone da Secretaria
              </label>
              <input
                type="tel"
                placeholder="+509 3700-0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-navy uppercase mb-1">
                Nome do Diretor / Reitor *
              </label>
              <input
                type="text"
                placeholder="Ex: Jean-Pierre Dessalines"
                value={form.principal}
                onChange={(e) => setForm({ ...form, principal: e.target.value })}
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-navy uppercase mb-1">
                Cidade / Comuna
              </label>
              <input
                type="text"
                placeholder="Port-au-Prince"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-navy uppercase mb-1">
                Endereço
              </label>
              <input
                type="text"
                placeholder="Rue Capois, Champ de Mars"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Bloco 2: Administrador da Escola (apenas na criação) */}
        {!school && (
          <div className="pt-4 border-t border-brand-navy/10">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-navy mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              2. Administrador Responsável (Conta do Diretor)
            </h4>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-xs font-bold text-brand-navy uppercase mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome do Administrador"
                  value={form.adminName}
                  onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-navy uppercase mb-1">
                  E-mail de Login *
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@ecole.ht"
                  value={form.adminEmail}
                  onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-navy uppercase mb-1">
                  Senha Provisória *
                </label>
                <input
                  type="text"
                  required
                  value={form.adminPassword}
                  onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Bloco 3: Configuração de Módulos (Família e Financeiro) */}
        <div className="pt-4 border-t border-brand-navy/10">
          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-navy mb-1 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600" />
            3. Acesso aos Módulos (Permissões da Escola)
          </h4>
          <p className="text-xs text-brand-navy/60 mb-4">
            Defina quais ferramentas estarão visíveis e liberadas para os usuários desta instituição.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Módulo Financeiro */}
            <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-xs font-bold text-brand-navy block">Módulo Financeiro</strong>
                  <span className="text-[11px] text-slate-500">Cobranças, mensalidades e relatórios.</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.enableFinance}
                onChange={(e) => setForm({ ...form, enableFinance: e.target.checked })}
                className="w-5 h-5 accent-brand-navy rounded cursor-pointer"
              />
            </label>

            {/* Acesso Família */}
            <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-xs font-bold text-brand-navy block">Espaço Família (Pais)</strong>
                  <span className="text-[11px] text-slate-500">Acesso aos boletins e recados da escola.</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.enableFamilyAccess}
                onChange={(e) => setForm({ ...form, enableFamilyAccess: e.target.checked })}
                className="w-5 h-5 accent-brand-navy rounded cursor-pointer"
              />
            </label>

            {/* Pagamentos Online */}
            <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-xs font-bold text-brand-navy block">MonCash & Pagamentos</strong>
                  <span className="text-[11px] text-slate-500">Baixa automática via Mobile Money.</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.enablePayment}
                onChange={(e) => setForm({ ...form, enablePayment: e.target.checked })}
                className="w-5 h-5 accent-brand-navy rounded cursor-pointer"
              />
            </label>

            {/* Modo Offline */}
            <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Wifi className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-xs font-bold text-brand-navy block">Sincronização Offline</strong>
                  <span className="text-[11px] text-slate-500">Operação em Survival Mode nas salas.</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.enableSync}
                onChange={(e) => setForm({ ...form, enableSync: e.target.checked })}
                className="w-5 h-5 accent-brand-navy rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-3 pt-4 border-t border-brand-navy/10">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {t("cancel", "Cancelar")}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-brand-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-navy/90 disabled:opacity-50 shadow-sm transition-colors"
          >
            {loading ? t("saving", "Salvando...") : school ? t("save", "Salvar Alterações") : "Cadastrar Escola & Admin"}
          </button>
        </div>
      </form>
    </div>
  )
}

export default SchoolForm