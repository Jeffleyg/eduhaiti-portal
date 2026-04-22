import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { apiFetch } from "../lib/api.js"

function GuardianTuitionPayment() {
  const [enrollmentNumber, setEnrollmentNumber] = useState("")
  const [lookupLoading, setLookupLoading] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [studentInfo, setStudentInfo] = useState(null)
  const [charges, setCharges] = useState([])

  const [paymentForm, setPaymentForm] = useState({
    provider: "moncash",
    accountNumber: "",
    amountHtg: "",
    tuitionPaymentId: "",
    guardianName: "",
    guardianPhone: "",
  })

  const totalPending = useMemo(
    () => charges.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    [charges],
  )

  const loadPending = async (event) => {
    event.preventDefault()
    setLookupLoading(true)
    setError("")
    setMessage("")

    try {
      const data = await apiFetch(`/finance/tuition/${encodeURIComponent(enrollmentNumber.trim())}/pending`)
      setStudentInfo(data.student)
      setCharges(data.charges ?? [])
      setMessage("Cobrancas carregadas com sucesso.")
    } catch (err) {
      setError(err.message)
      setStudentInfo(null)
      setCharges([])
    } finally {
      setLookupLoading(false)
    }
  }

  const payTuition = async (event) => {
    event.preventDefault()
    setPayLoading(true)
    setError("")
    setMessage("")

    try {
      const idempotencyKey = crypto.randomUUID()
      const result = await apiFetch("/finance/tuition/pay", {
        method: "POST",
        body: {
          provider: paymentForm.provider,
          accountNumber: paymentForm.accountNumber,
          studentEnrollmentNumber: enrollmentNumber.trim(),
          idempotencyKey,
          amountHtg: Number(paymentForm.amountHtg),
          tuitionPaymentId: paymentForm.tuitionPaymentId || undefined,
          guardianName: paymentForm.guardianName || undefined,
          guardianPhone: paymentForm.guardianPhone || undefined,
        },
      })

      setMessage(`Pagamento confirmado. Recibo: ${result.receiptNumber}`)
      setPaymentForm((prev) => ({ ...prev, amountHtg: "", tuitionPaymentId: "" }))
      const refreshed = await apiFetch(`/finance/tuition/${encodeURIComponent(enrollmentNumber.trim())}/pending`)
      setStudentInfo(refreshed.student)
      setCharges(refreshed.charges ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setPayLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-sand px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-brand-navy/10 bg-white/80 p-6 shadow-xl shadow-brand-navy/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-brand-navy">Pagamento de Escolaridade</h1>
            <p className="mt-1 text-sm text-brand-navy/70">
              Area para responsaveis consultarem e pagarem mensalidades.
            </p>
          </div>
          <Link to="/" className="outline-button">
            Voltar
          </Link>
        </div>

        {error ? <p className="text-sm text-brand-red">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

        <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
          <h2 className="text-base font-semibold text-brand-navy">1. Consultar cobrancas</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={loadPending}>
            <input
              value={enrollmentNumber}
              onChange={(event) => setEnrollmentNumber(event.target.value)}
              placeholder="Matricula do aluno (ex: 2026-0001)"
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
              required
            />
            <button className="primary-button" disabled={lookupLoading} type="submit">
              {lookupLoading ? "Consultando..." : "Consultar"}
            </button>
          </form>

          {studentInfo ? (
            <div className="mt-4 rounded-2xl border border-brand-navy/10 bg-sand p-3">
              <p className="text-sm text-brand-navy">
                Aluno: <strong>{studentInfo.name}</strong>
              </p>
              <p className="text-xs text-brand-navy/70">Matricula: {studentInfo.enrollmentNumber}</p>
              <p className="text-xs text-brand-navy/70">Total pendente: {totalPending.toFixed(2)} HTG</p>
            </div>
          ) : null}

          {charges.length > 0 ? (
            <div className="mt-3 space-y-2">
              {charges.map((charge) => (
                <div key={charge.id} className="rounded-xl border border-brand-navy/10 bg-white p-3">
                  <p className="text-sm text-brand-navy">{Number(charge.amount).toFixed(2)} HTG</p>
                  <p className="text-xs text-brand-navy/60">Status: {charge.status}</p>
                  <p className="text-xs text-brand-navy/60">
                    Vencimento: {new Date(charge.dueDate).toLocaleDateString()}
                  </p>
                  {charge.description ? <p className="text-xs text-brand-navy/60">{charge.description}</p> : null}
                </div>
              ))}
            </div>
          ) : studentInfo ? (
            <p className="mt-3 text-xs text-brand-navy/60">Sem cobrancas pendentes para este aluno.</p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
          <h2 className="text-base font-semibold text-brand-navy">2. Efetuar pagamento</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={payTuition}>
            <select
              value={paymentForm.provider}
              onChange={(event) => setPaymentForm((prev) => ({ ...prev, provider: event.target.value }))}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            >
              <option value="moncash">MonCash</option>
              <option value="natcash">NatCash</option>
            </select>

            <input
              value={paymentForm.accountNumber}
              onChange={(event) =>
                setPaymentForm((prev) => ({ ...prev, accountNumber: event.target.value }))
              }
              placeholder="Numero da conta/carteira"
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
              required
            />

            <input
              type="number"
              min="1"
              step="0.01"
              value={paymentForm.amountHtg}
              onChange={(event) => setPaymentForm((prev) => ({ ...prev, amountHtg: event.target.value }))}
              placeholder="Valor em HTG"
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
              required
            />

            <select
              value={paymentForm.tuitionPaymentId}
              onChange={(event) =>
                setPaymentForm((prev) => ({ ...prev, tuitionPaymentId: event.target.value }))
              }
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            >
              <option value="">Sem vincular a cobranca especifica</option>
              {charges.map((charge) => (
                <option key={charge.id} value={charge.id}>
                  {Number(charge.amount).toFixed(2)} HTG - {charge.status}
                </option>
              ))}
            </select>

            <input
              value={paymentForm.guardianName}
              onChange={(event) =>
                setPaymentForm((prev) => ({ ...prev, guardianName: event.target.value }))
              }
              placeholder="Nome do responsavel (opcional)"
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            />

            <input
              value={paymentForm.guardianPhone}
              onChange={(event) =>
                setPaymentForm((prev) => ({ ...prev, guardianPhone: event.target.value }))
              }
              placeholder="Telefone do responsavel (opcional)"
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            />

            <button className="primary-button md:col-span-2" disabled={payLoading || !enrollmentNumber.trim()} type="submit">
              {payLoading ? "Processando..." : "Pagar escolaridade"}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

export default GuardianTuitionPayment
