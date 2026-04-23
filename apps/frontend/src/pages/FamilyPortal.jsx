import { useState } from "react"
import { Link } from "react-router-dom"
import { apiFetch } from "../lib/api.js"

function FamilyPortal() {
  const [enrollmentNumber, setEnrollmentNumber] = useState("")
  const [guardianName, setGuardianName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [overview, setOverview] = useState(null)

  const [contactForm, setContactForm] = useState({
    subject: "",
    body: "",
    guardianPhone: "",
    urgent: false,
  })

  const loadOverview = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const data = await apiFetch(
        `/family/overview/${encodeURIComponent(enrollmentNumber.trim())}?guardianName=${encodeURIComponent(guardianName.trim())}`,
      )
      setOverview(data)
    } catch (err) {
      setOverview(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const sendContactRequest = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await apiFetch("/family/contact-request", {
        method: "POST",
        body: {
          enrollmentNumber: enrollmentNumber.trim(),
          guardianName: guardianName.trim(),
          guardianPhone: contactForm.guardianPhone || undefined,
          subject: contactForm.subject,
          body: contactForm.body,
          urgent: contactForm.urgent,
        },
      })
      setMessage("Sua mensagem foi enviada para a secretaria.")
      setContactForm({ subject: "", body: "", guardianPhone: "", urgent: false })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-sand px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6 rounded-3xl border border-brand-navy/10 bg-white/80 p-6 shadow-xl shadow-brand-navy/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-brand-navy">Espaco da Familia</h1>
            <p className="mt-1 text-sm text-brand-navy/70">
              Acompanhe desempenho, assiduidade e comunicados sem usar a conta do aluno.
            </p>
          </div>
          <Link to="/" className="outline-button">Voltar</Link>
        </div>

        {error ? <p className="text-sm text-brand-red">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
          <h2 className="text-base font-semibold text-brand-navy">Acesso parental</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-3" onSubmit={loadOverview}>
            <input
              value={enrollmentNumber}
              onChange={(event) => setEnrollmentNumber(event.target.value)}
              placeholder="Matricula do aluno"
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
              required
            />
            <input
              value={guardianName}
              onChange={(event) => setGuardianName(event.target.value)}
              placeholder="Nome do responsavel (pai/mae)"
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
              required
            />
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Carregando..." : "Consultar"}
            </button>
          </form>
        </section>

        {overview ? (
          <>
            <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
              <h3 className="font-semibold text-brand-navy">Aluno</h3>
              <p className="text-sm text-brand-navy">{overview.student?.name}</p>
              <p className="text-xs text-brand-navy/70">Matricula: {overview.student?.enrollmentNumber}</p>
              <p className="text-xs text-brand-navy/70">
                Turmas: {(overview.student?.classes ?? []).map((item) => item.name).join(", ") || "-"}
              </p>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-brand-navy/10 bg-white p-4">
                <h3 className="font-semibold text-brand-navy">Desempenho academico</h3>
                <div className="mt-3 space-y-2">
                  {(overview.grades ?? []).length ? (
                    overview.grades.map((item) => (
                      <div key={item.id} className="rounded-xl border border-brand-navy/10 p-3 text-sm">
                        <p className="font-semibold text-brand-navy">{item.discipline?.name} - {item.class?.name}</p>
                        <p className="text-brand-navy/70">Nota: {item.score}/{item.maxScore}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-brand-navy/60">Sem notas publicadas.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-brand-navy/10 bg-white p-4">
                <h3 className="font-semibold text-brand-navy">Assiduidade</h3>
                <div className="mt-3 space-y-2">
                  {(overview.attendance ?? []).length ? (
                    overview.attendance.map((item) => (
                      <div key={item.id} className="rounded-xl border border-brand-navy/10 p-3 text-sm">
                        <p className="font-semibold text-brand-navy">{new Date(item.date).toLocaleDateString("pt-BR")} - {item.class?.name}</p>
                        <p className="text-brand-navy/70">Status: {item.status}</p>
                        {item.remarks ? <p className="text-brand-navy/60">Obs: {item.remarks}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-brand-navy/60">Sem dados de presenca.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-brand-navy/10 bg-white p-4">
                <h3 className="font-semibold text-brand-navy">Avisos da escola</h3>
                <div className="mt-3 space-y-2">
                  {(overview.announcements ?? []).length ? (
                    overview.announcements.map((item) => (
                      <div key={item.id} className="rounded-xl border border-brand-navy/10 p-3 text-sm">
                        <p className="font-semibold text-brand-navy">{item.title}</p>
                        <p className="text-brand-navy/70">{item.content}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-brand-navy/60">Sem avisos recentes.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-brand-navy/10 bg-white p-4">
                <h3 className="font-semibold text-brand-navy">Ocorrencias e urgencias</h3>
                <div className="mt-3 space-y-2">
                  {(overview.familyNotices ?? []).length ? (
                    overview.familyNotices.map((item) => (
                      <div key={item.id} className="rounded-xl border border-brand-navy/10 p-3 text-sm">
                        <p className="font-semibold text-brand-navy">{String(item.title ?? "Recado")}</p>
                        <p className="text-brand-navy/70">{String(item.body ?? "")}</p>
                        <p className="text-xs text-brand-navy/60">{new Date(item.createdAt).toLocaleString("pt-BR")}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-brand-navy/60">Sem recados especiais.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
              <h3 className="font-semibold text-brand-navy">Canal direto com a secretaria</h3>
              <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={sendContactRequest}>
                <input
                  value={contactForm.subject}
                  onChange={(event) => setContactForm((prev) => ({ ...prev, subject: event.target.value }))}
                  placeholder="Assunto"
                  className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-2"
                  required
                />
                <textarea
                  value={contactForm.body}
                  onChange={(event) => setContactForm((prev) => ({ ...prev, body: event.target.value }))}
                  placeholder="Mensagem"
                  rows={4}
                  className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-2"
                  required
                />
                <input
                  value={contactForm.guardianPhone}
                  onChange={(event) => setContactForm((prev) => ({ ...prev, guardianPhone: event.target.value }))}
                  placeholder="Telefone para retorno (opcional)"
                  className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 text-sm text-brand-navy">
                  <input
                    type="checkbox"
                    checked={contactForm.urgent}
                    onChange={(event) => setContactForm((prev) => ({ ...prev, urgent: event.target.checked }))}
                  />
                  Marcar como urgente
                </label>
                <button className="primary-button md:col-span-2" type="submit" disabled={loading}>
                  Enviar para secretaria
                </button>
              </form>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default FamilyPortal
