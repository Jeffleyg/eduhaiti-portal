import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/api.js'

function SchoolForm({ school, onSuccess, onCancel, token }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Haiti',
    principal: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (school) {
      setForm(school)
    }
  }, [school])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (school) {
        await apiFetch(`/owner/schools/${school.id}`, {
          method: 'PATCH',
          token,
          body: form,
        })
      } else {
        await apiFetch('/owner/schools', {
          method: 'POST',
          token,
          body: form,
        })
      }
      onSuccess(form)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-brand-navy/10 bg-white p-6">
      <h3 className="font-semibold text-brand-navy mb-4">
        {school ? 'Editar Escola' : 'Criar Nova Escola'}
      </h3>

      {error && (
        <p className="mb-4 rounded-lg bg-brand-red/10 p-3 text-sm text-brand-red">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <input
          type="text"
          placeholder="Nome da Escola"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          className="rounded-lg border border-brand-navy/10 px-3 py-2 text-sm"
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          className="rounded-lg border border-brand-navy/10 px-3 py-2 text-sm"
        />
        <input
          type="tel"
          placeholder="Telefone"
          value={form.phone || ''}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="rounded-lg border border-brand-navy/10 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Endereço"
          value={form.address || ''}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="rounded-lg border border-brand-navy/10 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Cidade"
          value={form.city || ''}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          className="rounded-lg border border-brand-navy/10 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="País"
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
          className="rounded-lg border border-brand-navy/10 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Diretor/Diretora"
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
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-brand-navy/20 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-navy/5"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

export default SchoolForm
