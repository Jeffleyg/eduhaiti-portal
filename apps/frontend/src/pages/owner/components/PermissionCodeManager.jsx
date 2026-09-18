import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/api.js'
import { sanitizeText } from '../../../lib/string.js'

function PermissionCodeManager({ schoolId, token }) {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', expiresIn: 30 })
  const [error, setError] = useState('')

  useEffect(() => {
    loadCodes()
  }, [schoolId])

  const loadCodes = async () => {
    setLoading(true)
    try {
      const data = await apiFetch(`/owner/schools/${schoolId}/permission-codes`, { token })
      setCodes(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const newCode = await apiFetch(`/owner/schools/${schoolId}/permission-codes`, {
        method: 'POST',
        token,
        body: form,
      })
      setCodes([...codes, newCode])
      setForm({ name: '', expiresIn: 30 })
      setShowForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async (codeId) => {
    if (!window.confirm('Revogar este código?')) return

    try {
      await apiFetch(`/owner/permission-codes/${codeId}`, {
        method: 'DELETE',
        token,
      })
      setCodes(codes.filter((c) => c.id !== codeId))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-brand-navy text-sm">Códigos de Permissão</h4>
      {error && <p className="text-xs text-brand-red">{error}</p>}

      <button
        onClick={() => setShowForm(!showForm)}
        className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
      >
        {showForm ? 'Cancelar' : '+ Gerar Código'}
      </button>

      {showForm && (
        <form onSubmit={handleGenerate} className="flex gap-2 text-xs">
          <input
            type="text"
            placeholder="Nome (opcional)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="flex-1 rounded border border-brand-navy/10 px-2 py-1"
          />
          <select
            value={form.expiresIn}
            onChange={(e) => setForm({ ...form, expiresIn: parseInt(e.target.value) })}
            className="rounded border border-brand-navy/10 px-2 py-1"
          >
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-500 text-white px-3 py-1 hover:bg-blue-600 disabled:opacity-50"
          >
            Gerar
          </button>
        </form>
      )}

      {codes.length === 0 ? (
        <p className="text-xs text-brand-navy/50">Nenhum código gerado</p>
      ) : (
        <div className="space-y-2">
          {codes.map((code) => (
            <div key={code.id} className="flex items-center justify-between bg-gray-50 p-2 rounded text-xs">
              <div>
                <p className="font-mono font-bold text-brand-navy">{code.code}</p>
                {code.name && <p className="text-gray-600">{sanitizeText(code.name)}</p>}
                {code.usedAt && <p className="text-gray-500">Usado por: {sanitizeText(code.usedBy)}</p>}
              </div>
              <button
                onClick={() => handleRevoke(code.id)}
                className="text-brand-red hover:underline text-xs"
              >
                Revogar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PermissionCodeManager
