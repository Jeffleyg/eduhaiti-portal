import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../../lib/api.js'

const initialFormState = {
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  country: 'Haiti',
  principal: '',
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
        city: school.city ?? '',
        country: school.country ?? 'Haiti',
        principal: school.principal ?? '',
      })
      return
    }

    setForm(initialFormState)
  }, [school])

  const buildPayload = () => ({
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    city: form.city.trim(),
    country: form.country.trim() || 'Haiti',
    principal: form.principal.trim(),
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = buildPayload()

    try {
      let response
      if (school) {
        response = await apiFetch(`/owner/schools/${school.id}`, {
          method: 'PATCH',
          token,
          body: payload,
        })
        onSuccess?.({ school: response?.school ?? school, accessLink: null, accessCode: null })
      } else {
        response = await apiFetch('/owner/schools', {
          method: 'POST',
          token,
          body: payload,
        })
        const createdSchool = response?.school ?? response
        let accessLink = null
        let accessCode = null

        if (createdSchool?.id) {
          const permissionCode = await apiFetch(`/owner/schools/${createdSchool.id}/permission-codes`, {
            method: 'POST',
            token,
            body: { name: 'Acesso inicial', expiresIn: 30 },
          })

          accessCode = permissionCode?.code ?? null
          accessLink = permissionCode?.shareUrl ?? null
        }

        onSuccess?.({
          school: createdSchool,
          accessLink,
          accessCode,
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-brand-navy/10 bg-white p-6">
      <h3 className="font-semibold text-brand-navy mb-4">
        {school ? t("editSchool") : t("createNewSchool")}
      </h3>

      {error && (
        <p className="mb-4 rounded-lg bg-brand-red/10 p-3 text-sm text-brand-red">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <input
          type="text"
          placeholder={t("schoolName")}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          className="rounded-lg border border-brand-navy/10 px-3 py-2 text-sm"
        />
        <input
          type="email"
          placeholder={t("email")}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          className="rounded-lg border border-brand-navy/10 px-3 py-2 text-sm"
        />
        <input
          type="tel"
          placeholder={t("phone")}
          value={form.phone || ''}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="rounded-lg border border-brand-navy/10 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder={t("address")}
          value={form.address || ''}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="rounded-lg border border-brand-navy/10 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder={t("city")}
          value={form.city || ''}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          className="rounded-lg border border-brand-navy/10 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder={t("country")}
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
          className="rounded-lg border border-brand-navy/10 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder={t("principal")}
          value={form.principal || ''}
          onChange={(e) => setForm({ ...form, principal: e.target.value })}
          className="rounded-lg border border-brand-navy/10 px-3 py-2 text-sm"
        />

        <div className="flex gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red/90 disabled:opacity-50"
          >
            {loading ? t("saving") : t("save")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-brand-navy/20 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-navy/5"
          >
            {t("cancel")}
          </button>
        </div>
      </form>
    </div>
  )
}

export default SchoolForm
