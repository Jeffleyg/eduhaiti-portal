import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch, apiFetchRaw } from "../../lib/api.js"
import FinanceChargeForm from "./components/FinanceChargeForm.jsx"
import FinanceInstallmentForm from "./components/FinanceInstallmentForm.jsx"
import FinanceFiltersAndSummary from "./components/FinanceFiltersAndSummary.jsx"
import FinancePaymentHistory from "./components/FinancePaymentHistory.jsx"
import LoadingState from "../../components/LoadingState.jsx"
import Button from "../../components/Button.jsx"
import { CreditCard, Handshake, History } from "lucide-react"
import PixAccountManager from "../../components/PixAccountManager.jsx"

function AdminFinanceControl() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [filters, setFilters] = useState({
    studentEnrollmentNumber: "",
    status: "ALL",
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
  const [activeSection, setActiveSection] = useState("charge")

  const buildFilterQuery = (includePagination = true) => {
    const params = new URLSearchParams()
    if (filters.studentEnrollmentNumber.trim()) {
      params.set("studentEnrollmentNumber", filters.studentEnrollmentNumber.trim())
    }
    if (filters.status && filters.status !== "ALL") {
      params.set("status", filters.status)
    }
    if (filters.startDate) {
      params.set("startDate", filters.startDate)
    }
    if (filters.endDate) {
      params.set("endDate", filters.endDate)
    }
    if (includePagination) {
      params.set("page", String(filters.page))
      params.set("pageSize", String(filters.pageSize))
    }
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
      setMessage(t("dashboardLoaded"))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const exportCsv = async () => {
    setLoading(true)
    setError("")

    try {
      const query = buildFilterQuery(false)
      const response = await apiFetchRaw(`/finance/admin/payments/export?${query}`, {
        token,
      })

      const csvText = await response.text()
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `financeiro-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setMessage(t("csvExported"))
      setTimeout(() => setMessage(""), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("financeControlTitle")}
        subtitle={t("financeControlSubtitle")}
      />

      {error && <LoadingState type="banner" error={error} message={error} />}
      {message && <LoadingState type="banner" success message={message} />}

      {/* Toolbar de funções como botões */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={activeSection === "charge" ? "primary" : "outline"}
          onClick={() => setActiveSection("charge")}
        >
          {t("btnCreateCharge")}
        </Button>
        <Button
          type="button"
          variant={activeSection === "installment" ? "primary" : "outline"}
          onClick={() => setActiveSection("installment")}
        >
          {t("btnInstallment")}
        </Button>
        <Button
          type="button"
          variant={activeSection === "filters" ? "primary" : "outline"}
          onClick={() => setActiveSection("filters")}
        >
          {t("btnFilters")}
        </Button>
        <Button
          type="button"
          variant={activeSection === "history" ? "primary" : "outline"}
          onClick={() => setActiveSection("history")}
        >
          {t("btnHistory")}
        </Button>
        <Button
          type="button"
          variant={activeSection === "pix" ? "primary" : "outline"}
          onClick={() => setActiveSection("pix")}
        >
          {t("btnPix")}
        </Button>
      </div>

      {/* Sections rendered by active button */}
      {activeSection === "charge" && (
        <div className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6 mt-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-brand-navy/10 p-2">
              <CreditCard className="h-5 w-5 text-brand-navy" />
            </div>
            <div>
              <h2 className="font-semibold text-brand-navy">{t("newTuitionCharge")}</h2>
              <p className="text-xs text-brand-navy/60">{t("createTuitionChargeDesc")}</p>
            </div>
          </div>
          <FinanceChargeForm onSuccess={loadDashboard} loading={loading} />
        </div>
      )}

      {activeSection === "installment" && (
        <div className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6 mt-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-brand-navy/10 p-2">
              <Handshake className="h-5 w-5 text-brand-navy" />
            </div>
            <div>
              <h2 className="font-semibold text-brand-navy">{t("renegotiationInstallment")}</h2>
              <p className="text-xs text-brand-navy/60">{t("renegotiationInstallmentDesc")}</p>
            </div>
          </div>
          <FinanceInstallmentForm onSuccess={loadDashboard} loading={loading} />
        </div>
      )}

      {activeSection === "filters" && (
        <div className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6 mt-4">
          <h2 className="mb-4 font-semibold text-brand-navy">{t("filtersAndSummary")}</h2>
          <FinanceFiltersAndSummary
            filters={filters}
            summary={summary}
            onFilterChange={setFilters}
            onLoadDashboard={loadDashboard}
            onExportCsv={exportCsv}
            loading={loading}
          />
        </div>
      )}

      {activeSection === "history" && (
        <div className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6 mt-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-brand-navy/10 p-2">
              <History className="h-5 w-5 text-brand-navy" />
            </div>
            <div>
              <h2 className="font-semibold text-brand-navy">{t("paymentHistory")}</h2>
              <p className="text-xs text-brand-navy/60">{t("paymentHistoryDesc")}</p>
            </div>
          </div>
          <FinancePaymentHistory
            payments={payments}
            loading={loading && payments.length === 0}
            pagination={pagination}
            onPageChange={(newPage) => {
              setFilters((prev) => ({ ...prev, page: newPage }))
              setTimeout(loadDashboard, 0)
            }}
          />
        </div>
      )}

      {activeSection === "pix" && (
        <div className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6 mt-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2">
              <CreditCard className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="font-semibold text-brand-navy">{t("pixAccountTitle")}</h2>
              <p className="text-xs text-brand-navy/60">{t("pixAccountSubtitle")}</p>
            </div>
          </div>
          <PixAccountManager token={token} />
        </div>
      )}
    </div>
  )
}

export default AdminFinanceControl
