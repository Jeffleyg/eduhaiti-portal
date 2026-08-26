import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api.js'
import { Copy, Lock, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'

export default function PixAccountManager({ token }) {
  const { t } = useTranslation()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copySuccessId, setCopySuccessId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    keyType: 'CPF',
    key: '',
    accountHolderName: '',
    bankCode: '',
    accountNumber: '',
    accountBranch: '',
    description: '',
  })

  const stats = useMemo(() => {
    const active = accounts.filter((account) => account.isActive).length
    const primary = accounts.filter((account) => account.isPrimary).length

    return {
      total: accounts.length,
      active,
      primary,
      inactive: accounts.length - active,
    }
  }, [accounts])

  const keyTypeLabels = {
    CPF: t("pixKeyTypeCpf"),
    CNPJ: t("pixKeyTypeCnpj"),
    EMAIL: t("pixKeyTypeEmail"),
    PHONE: t("pixKeyTypePhone"),
    RANDOM: t("pixKeyTypeRandom"),
  }

  useEffect(() => {
    loadAccounts()
  }, [token])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      const data = await apiFetch('/finance/pix-accounts', { token })
      setAccounts(data)
    } catch (err) {
      setError(err.message || t('pixAccountLoadError'))
    } finally {
      setLoading(false)
    }
  }

  const copyPixKey = async (account) => {
    try {
      await navigator.clipboard.writeText(account.key)
      setCopySuccessId(account.id)
      setTimeout(() => setCopySuccessId(''), 2000)
    } catch {
      setError(t('pixAccountCopyFailed'))
    }
  }

  const handleAddAccount = async (e) => {
    e.preventDefault()
    try {
      setError('')
      setSuccess('')
      await apiFetch('/finance/pix-accounts', {
        method: 'POST',
        body: formData,
        token,
      })
      setFormData({
        keyType: 'CPF',
        key: '',
        accountHolderName: '',
        bankCode: '',
        accountNumber: '',
        accountBranch: '',
        description: '',
      })
      setShowForm(false)
      await loadAccounts()
      setSuccess(t('pixAccountCreatedSuccess'))
    } catch (err) {
      setError(err.message || t('pixAccountCreatedError'))
    }
  }

  const handleSetPrimary = async (accountId) => {
    try {
      setError('')
      setSuccess('')
      await apiFetch(`/finance/pix-accounts/${accountId}/primary`, {
        method: 'POST',
        token,
      })
      await loadAccounts()
      setSuccess(t('pixAccountPrimaryUpdated'))
    } catch (err) {
      setError(err.message || t('pixAccountPrimaryError'))
    }
  }

  const handleToggleStatus = async (accountId, currentStatus) => {
    try {
      setError('')
      setSuccess('')
      await apiFetch(`/finance/pix-accounts/${accountId}/status`, {
        method: 'PATCH',
        body: { isActive: !currentStatus },
        token,
      })
      await loadAccounts()
      setSuccess(currentStatus ? t('pixAccountDeactivated') : t('pixAccountActivated'))
    } catch (err) {
      setError(err.message || t('pixAccountStatusError'))
    }
  }

  const handleDelete = async (accountId) => {
    if (!window.confirm(t('pixAccountDeleteConfirm'))) return
    try {
      setError('')
      setSuccess('')
      await apiFetch(`/finance/pix-accounts/${accountId}`, {
        method: 'DELETE',
        token,
      })
      await loadAccounts()
      setSuccess(t('pixAccountDeletedSuccess'))
    } catch (err) {
      setError(err.message || t('pixAccountDeleteError'))
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sand p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
              <ShieldCheck size={14} />
              {t("pixAccountTitle")}
            </div>
            <h2 className="font-display text-2xl text-brand-navy">{t("pixAccountTitle")}</h2>
            <p className="text-sm text-brand-navy/70">{t("pixAccountSubtitle")}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadAccounts}
              className="outline-button flex items-center gap-2"
              type="button"
            >
              <RefreshCw size={16} />
              {t("reload")}
            </button>
            <button
              onClick={() => setShowForm((prev) => !prev)}
              className="primary-button flex items-center gap-2"
              type="button"
            >
              <Plus size={16} />
              {showForm ? t("closeForm") : t("newPixAccount")}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: t("pixAccountsTotal"), value: stats.total },
            { label: t("pixAccountsActive"), value: stats.active },
            { label: t("pixAccountsPrimary"), value: stats.primary },
            { label: t("pixAccountsInactive"), value: stats.inactive },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-navy/55">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-brand-navy">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-brand-red">{error}</p>}
      {success && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>}

      {showForm && (
        <div className="rounded-3xl border border-brand-navy/10 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-100 p-2 text-emerald-700">
              <Plus size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-brand-navy">{t("registerPixAccount")}</h3>
              <p className="text-xs text-brand-navy/60">{t("configurePixAccountHelp")}</p>
            </div>
          </div>

          <form onSubmit={handleAddAccount} className="grid gap-3 md:grid-cols-12">
            <select
              value={formData.keyType}
              onChange={(e) => setFormData({ ...formData, keyType: e.target.value })}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-3"
            >
              <option value="CPF">{t("pixKeyTypeCpf")}</option>
              <option value="CNPJ">{t("pixKeyTypeCnpj")}</option>
              <option value="EMAIL">{t("pixKeyTypeEmail")}</option>
              <option value="PHONE">{t("pixKeyTypePhone")}</option>
              <option value="RANDOM">{t("pixKeyTypeRandom")}</option>
            </select>

            <input
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder={t("pixKeyPlaceholder")}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-3"
              required
            />

            <input
              value={formData.accountHolderName}
              onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
              placeholder={t("accountHolderPlaceholder")}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-3"
            />

            <input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t("internalDescriptionPlaceholder")}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-3"
            />

            <input
              value={formData.bankCode}
              onChange={(e) => setFormData({ ...formData, bankCode: e.target.value })}
              placeholder={t("bankPlaceholder")}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-4"
            />

            <input
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              placeholder={t("accountPlaceholder")}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-4"
            />

            <input
              value={formData.accountBranch}
              onChange={(e) => setFormData({ ...formData, accountBranch: e.target.value })}
              placeholder={t("branchPlaceholder")}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-4"
            />

            <div className="md:col-span-12 flex justify-end">
              <button type="submit" className="primary-button">
                {t("savePixAccount")}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-3xl border border-brand-navy/10 bg-white p-5 text-sm text-brand-navy/60">
            {t("loadingPixAccounts")}
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-brand-navy/15 bg-white p-8 text-center">
            <p className="font-semibold text-brand-navy">{t("noPixAccounts")}</p>
            <p className="mt-1 text-sm text-brand-navy/60">{t("pixReceiveMessage")}</p>
          </div>
        ) : (
          accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-3xl border border-brand-navy/10 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <Lock size={14} />
                      {keyTypeLabels[account.keyType] || account.keyType}
                    </div>
                    {account.isPrimary && <span className="badge bg-emerald-100 text-emerald-700">{t("primaryLabel")}</span>}
                    {!account.isActive && <span className="badge bg-red-100 text-red-700">{t("inactiveLabel")}</span>}
                  </div>

                  <div className="space-y-1">
                    <p className="font-mono text-sm font-semibold text-brand-navy break-all">{account.key}</p>
                    <p className="text-xs text-brand-navy/60">
                      {account.accountHolderName || t("holderNotProvided")}
                      {account.description ? ` · ${account.description}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyPixKey(account)}
                    className="outline-button flex items-center gap-2 text-xs"
                  >
                    <Copy size={14} />
                    {copySuccessId === account.id ? t("copied") : t("copyKey")}
                  </button>

                  {!account.isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(account.id)}
                      className="outline-button text-xs"
                    >
                      {t("setPrimary")}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleToggleStatus(account.id, account.isActive)}
                    className={`outline-button text-xs ${account.isActive ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}
                  >
                    {account.isActive ? t("deactivate") : t("activate")}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(account.id)}
                    className="outline-button text-xs bg-red-50 text-red-600"
                    title={t("delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
