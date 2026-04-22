import { useMemo, useState } from "react"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"

const initialChargeForm = {
  studentEnrollmentNumber: "",
  amountHtg: "",
  dueDate: "",
  description: "",
}

function AdminFinanceControl() {
  const { token } = useAuth()
  const [chargeForm, setChargeForm] = useState(initialChargeForm)
  const [filters, setFilters] = useState({
    studentEnrollmentNumber: "",
    status: "",
    startDate: "",
    endDate: "",
    page: 1,
    pageSize: 20,
  })
  const [summary, setSummary] = useState(null)
  const [payments, setPayments] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const statusOptions = useMemo(
    () => ["", "PENDING", "PARTIAL", "PAID", "OVERDUE"],
    [],
  )

  const buildFilterQuery = () => {
    const params = new URLSearchParams()
    if (filters.studentEnrollmentNumber.trim()) {
      params.set("studentEnrollmentNumber", filters.studentEnrollmentNumber.trim())
    }
    if (filters.status) {
      params.set("status", filters.status)
    }
    if (filters.startDate) {
      params.set("startDate", filters.startDate)
    }
    if (filters.endDate) {
      params.set("endDate", filters.endDate)
    }
    params.set("page", String(filters.page))
    params.set("pageSize", String(filters.pageSize))
    return params.toString()
  }

  const loadDashboard = async () => {
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const query = buildFilterQuery()
      const [summaryData, paymentsData] = await Promise.all([
        apiFetch(`/finance/admin/summary?${query}`, { token }),
        apiFetch(`/finance/admin/payments?${query}`, { token }),
      ])

      setSummary(summaryData)
      setPayments(paymentsData.rows ?? [])
      setPagination({
        page: Number(paymentsData.page ?? 1),
        pageSize: Number(paymentsData.pageSize ?? 20),
        total: Number(paymentsData.total ?? 0),
        totalPages: Number(paymentsData.totalPages ?? 1),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createCharge = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await apiFetch("/finance/admin/tuition-charges", {
        method: "POST",
        token,
        body: {
          studentEnrollmentNumber: chargeForm.studentEnrollmentNumber,
          amountHtg: Number(chargeForm.amountHtg),
          dueDate: chargeForm.dueDate,
          description: chargeForm.description || undefined,
        },
      })
      setMessage("Cobranca criada com sucesso.")
      setChargeForm(initialChargeForm)
      await loadDashboard()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Controle Financeiro"
        subtitle="Crie cobrancas e acompanhe pagamentos de escolaridade."
      />

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h3 className="text-base font-semibold text-brand-navy">Nova cobranca de escolaridade</h3>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createCharge}>
          <input
            value={chargeForm.studentEnrollmentNumber}
            onChange={(event) =>
              setChargeForm((prev) => ({ ...prev, studentEnrollmentNumber: event.target.value }))
            }
            placeholder="Matricula do aluno"
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <input
            type="number"
            min="1"
            step="0.01"
            value={chargeForm.amountHtg}
            onChange={(event) => setChargeForm((prev) => ({ ...prev, amountHtg: event.target.value }))}
            placeholder="Valor em HTG"
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <input
            type="date"
            value={chargeForm.dueDate}
            onChange={(event) => setChargeForm((prev) => ({ ...prev, dueDate: event.target.value }))}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            required
          />
          <input
            value={chargeForm.description}
            onChange={(event) => setChargeForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Descricao (opcional)"
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          />
          <button className="primary-button md:col-span-2" disabled={loading} type="submit">
            Criar cobranca
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6 space-y-4">
        <h3 className="text-base font-semibold text-brand-navy">Filtros e resumo</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={filters.studentEnrollmentNumber}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, studentEnrollmentNumber: event.target.value, page: 1 }))
            }
            placeholder="Filtrar por matricula"
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          />
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          >
            {statusOptions.map((status) => (
              <option key={status || "ALL"} value={status}>
                {status || "Todos os status"}
              </option>
            ))}
          </select>
          <button className="outline-button" type="button" onClick={loadDashboard} disabled={loading}>
            Carregar painel
          </button>
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value, page: 1 }))}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value, page: 1 }))}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          />
        </div>

        {summary ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-brand-navy/10 bg-white p-4">
              <p className="text-xs text-brand-navy/60">Total de pagamentos</p>
              <p className="text-2xl font-semibold text-brand-navy">{summary.totalPayments}</p>
            </div>
            <div className="rounded-2xl border border-brand-navy/10 bg-white p-4">
              <p className="text-xs text-brand-navy/60">Valor total (HTG)</p>
              <p className="text-2xl font-semibold text-brand-navy">{Number(summary.totalAmountHtg ?? 0).toFixed(2)}</p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h3 className="text-base font-semibold text-brand-navy">Historico de pagamentos</h3>

        {loading ? (
          <p className="mt-4 text-sm text-brand-navy/60">Carregando...</p>
        ) : payments.length === 0 ? (
          <p className="mt-4 text-sm text-brand-navy/60">Nenhum pagamento encontrado.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-2xl border border-brand-navy/10 bg-white p-4">
                <p className="font-semibold text-brand-navy">
                  {payment.student?.name} ({payment.student?.enrollmentNumber})
                </p>
                <p className="text-xs text-brand-navy/70">Status: {payment.status}</p>
                <p className="text-xs text-brand-navy/70">Valor: {Number(payment.amount).toFixed(2)} HTG</p>
                <p className="text-xs text-brand-navy/70">
                  Vencimento: {new Date(payment.dueDate).toLocaleDateString()}
                </p>
                {payment.paidDate ? (
                  <p className="text-xs text-brand-navy/70">
                    Pago em: {new Date(payment.paidDate).toLocaleString()}
                  </p>
                ) : null}
                {payment.receiptNumber ? (
                  <p className="text-xs text-brand-navy/70">Recibo: {payment.receiptNumber}</p>
                ) : null}
                {payment.description ? (
                  <p className="mt-1 text-xs text-brand-navy/60">{payment.description}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {pagination.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              className="outline-button"
              disabled={loading || pagination.page <= 1}
              onClick={() => {
                setFilters((prev) => ({ ...prev, page: prev.page - 1 }))
                setTimeout(loadDashboard, 0)
              }}
            >
              Anterior
            </button>
            <p className="text-xs text-brand-navy/70">
              Pagina {pagination.page} de {pagination.totalPages}
            </p>
            <button
              type="button"
              className="outline-button"
              disabled={loading || pagination.page >= pagination.totalPages}
              onClick={() => {
                setFilters((prev) => ({ ...prev, page: prev.page + 1 }))
                setTimeout(loadDashboard, 0)
              }}
            >
              Proxima
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default AdminFinanceControl
