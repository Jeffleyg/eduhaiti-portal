import { useState } from "react"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"

function AdminFamilyCommunication() {
  const { token } = useAuth()
  const [form, setForm] = useState({
    enrollmentNumber: "",
    title: "",
    body: "",
    severity: "normal",
    channel: "IN_APP",
    guardianPhone: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await apiFetch("/family/admin/notices", {
        method: "POST",
        token,
        body: {
          enrollmentNumber: form.enrollmentNumber,
          title: form.title,
          body: form.body,
          severity: form.severity,
          channel: form.channel,
          guardianPhone: form.guardianPhone || undefined,
        },
      })
      setMessage("Comunicado enviado para a familia com sucesso.")
      setForm((prev) => ({ ...prev, title: "", body: "", guardianPhone: "" }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Comunicacao Escola-Familia"
        subtitle="Envie ocorrencias disciplinares e recados urgentes para os encarregados."
      />

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <form onSubmit={submit} className="rounded-2xl border border-brand-navy/10 bg-white p-6 grid gap-3 md:grid-cols-2">
        <input
          value={form.enrollmentNumber}
          onChange={(event) => setForm((prev) => ({ ...prev, enrollmentNumber: event.target.value }))}
          placeholder="Matricula do aluno"
          className="rounded-xl border border-brand-navy/20 px-3 py-2"
          required
        />

        <select
          value={form.severity}
          onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value }))}
          className="rounded-xl border border-brand-navy/20 px-3 py-2"
        >
          <option value="normal">Normal</option>
          <option value="urgent">Urgente</option>
        </select>

        <select
          value={form.channel}
          onChange={(event) => setForm((prev) => ({ ...prev, channel: event.target.value }))}
          className="rounded-xl border border-brand-navy/20 px-3 py-2"
        >
          <option value="IN_APP">Mensagem interna</option>
          <option value="SMS">SMS (fila)</option>
          <option value="BOTH">Mensagem interna + SMS (fila)</option>
        </select>

        <input
          value={form.guardianPhone}
          onChange={(event) => setForm((prev) => ({ ...prev, guardianPhone: event.target.value }))}
          placeholder="Telefone do encarregado (para SMS)"
          className="rounded-xl border border-brand-navy/20 px-3 py-2"
        />

        <input
          value={form.title}
          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          placeholder="Titulo do comunicado"
          className="rounded-xl border border-brand-navy/20 px-3 py-2 md:col-span-2"
          required
        />

        <textarea
          value={form.body}
          onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
          placeholder="Detalhes da ocorrencia/urgencia"
          rows={5}
          className="rounded-xl border border-brand-navy/20 px-3 py-2 md:col-span-2"
          required
        />

        <button type="submit" className="primary-button md:col-span-2" disabled={loading}>
          {loading ? "Enviando..." : "Enviar comunicado"}
        </button>
      </form>
    </div>
  )
}

export default AdminFamilyCommunication
