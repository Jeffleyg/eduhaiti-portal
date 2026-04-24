import { useEffect, useState } from "react"
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
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [respondingRequestId, setRespondingRequestId] = useState("")
  const [requests, setRequests] = useState([])
  const [responseDrafts, setResponseDrafts] = useState({})
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadRequests = async () => {
    setLoadingRequests(true)
    setError("")

    try {
      const data = await apiFetch("/family/admin/contact-requests", { token })
      setRequests(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingRequests(false)
    }
  }

  useEffect(() => {
    if (token) {
      loadRequests()
    }
  }, [token])

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
      await loadRequests()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRespond = async (requestId) => {
    const responseMessage = responseDrafts[requestId]?.trim()

    if (!responseMessage) {
      setError("Escreva uma resposta antes de enviar.")
      return
    }

    setRespondingRequestId(requestId)
    setError("")
    setMessage("")

    try {
      await apiFetch(`/family/admin/contact-requests/${requestId}/respond`, {
        method: "POST",
        token,
        body: {
          responseMessage,
          notifyFamily: true,
        },
      })

      setMessage("Resposta enviada para a familia.")
      setResponseDrafts((prev) => ({ ...prev, [requestId]: "" }))
      await loadRequests()
    } catch (err) {
      setError(err.message)
    } finally {
      setRespondingRequestId("")
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

      <section className="rounded-2xl border border-brand-navy/10 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-brand-navy">Solicitacoes da familia</h3>
          <button type="button" className="outline-button" onClick={loadRequests} disabled={loadingRequests}>
            {loadingRequests ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {loadingRequests ? (
          <p className="text-sm text-brand-navy/60">Carregando solicitacoes...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-brand-navy/60">Nenhuma solicitacao recebida.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <article key={request.requestId} className="rounded-xl border border-brand-navy/10 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-brand-navy">{request.subject || "Sem assunto"}</p>
                    <p className="text-xs text-brand-navy/70">
                      Aluno: {request.student?.name || "-"} ({request.enrollmentNumber || "-"})
                    </p>
                    <p className="text-xs text-brand-navy/70">
                      Responsavel: {request.guardianName || "-"}
                      {request.guardianPhone ? ` | Tel: ${request.guardianPhone}` : ""}
                    </p>
                    <p className="text-xs text-brand-navy/60">
                      Recebido em: {new Date(request.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      request.status === "RESPONDED"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {request.status === "RESPONDED" ? "Respondido" : "Pendente"}
                  </span>
                </div>

                <p className="text-sm text-brand-navy/80 whitespace-pre-wrap">{request.body}</p>

                {request.response ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold text-emerald-800">Resposta enviada</p>
                    <p className="mt-1 text-sm text-emerald-900 whitespace-pre-wrap">
                      {request.response.responseMessage}
                    </p>
                    <p className="mt-1 text-xs text-emerald-700">
                      {new Date(request.response.respondedAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={responseDrafts[request.requestId] ?? ""}
                      onChange={(event) =>
                        setResponseDrafts((prev) => ({
                          ...prev,
                          [request.requestId]: event.target.value,
                        }))
                      }
                      placeholder="Escreva a resposta para esta familia"
                      rows={3}
                      className="w-full rounded-xl border border-brand-navy/20 px-3 py-2"
                    />
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => handleRespond(request.requestId)}
                      disabled={respondingRequestId === request.requestId}
                    >
                      {respondingRequestId === request.requestId ? "Enviando resposta..." : "Responder familia"}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default AdminFamilyCommunication
