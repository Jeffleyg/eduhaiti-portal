import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch, apiFetchRaw } from "../../lib/api.js"
import FinanceChargeForm from "./components/FinanceChargeForm.jsx"
import FinanceInstallmentForm from "./components/FinanceInstallmentForm.jsx"
import FinanceFiltersAndSummary from "./components/FinanceFiltersAndSummary.jsx"
import FinancePaymentHistory from "./components/FinancePaymentHistory.jsx"
import FinanceReports from "./components/FinanceReports.jsx"
import { downloadBlob, fileNameFrom } from "../../lib/download.js"
import LoadingState from "../../components/LoadingState.jsx"
import Button from "../../components/Button.jsx"
import { CreditCard, FileDown, Handshake, History } from "lucide-react"

function AdminFinanceControl() {
  const { t, i18n } = useTranslation()
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

  const buildFilterQuery = (includePagination = true, activeFilters = filters) => {
    const params = new URLSearchParams()
    if (activeFilters.studentEnrollmentNumber.trim()) {
      params.set("studentEnrollmentNumber", activeFilters.studentEnrollmentNumber.trim())
    }
    if (activeFilters.status && activeFilters.status !== "ALL") {
      params.set("status", activeFilters.status)
    }
    if (activeFilters.startDate) {
      params.set("startDate", activeFilters.startDate)
    }
    if (activeFilters.endDate) {
      params.set("endDate", activeFilters.endDate)
    }
    if (includePagination) {
      params.set("page", String(activeFilters.page))
      params.set("pageSize", String(activeFilters.pageSize))
    }
    return params.toString()
  }

  // `overrides` lets callers load a page before the filters state has re-rendered
  // `silent` skips the success banner (used for the automatic load on open).
  const loadDashboard = async (overrides = {}, { silent = false } = {}) => {
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const query = buildFilterQuery(true, { ...filters, ...overrides })
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
      if (!silent) setMessage(t("dashboardLoaded"))
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
      const params = new URLSearchParams(buildFilterQuery(false))
      params.set("lang", (i18n.resolvedLanguage || i18n.language || "fr").slice(0, 2))
      const response = await apiFetchRaw(`/finance/admin/payments/export?${params}`, {
        token,
      })

      const blob = await response.blob()
      downloadBlob(blob, fileNameFrom(response.headers.get("content-disposition"), "paiements.csv"))

      setMessage(t("csvExported"))
      setTimeout(() => setMessage(""), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Load the summary and the first page of payments when the page opens, so
  // the history is never empty just because nobody pressed "load" yet.
  useEffect(() => {
    if (token) loadDashboard({}, { silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

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
          variant={activeSection === "reports" ? "primary" : "outline"}
          onClick={() => setActiveSection("reports")}
        >
          {t("financeReportsTab")}
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
          <FinanceChargeForm onSuccess={() => loadDashboard()} loading={loading} />
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
          <FinanceInstallmentForm onSuccess={() => loadDashboard()} loading={loading} />
        </div>
      )}

      {activeSection === "filters" && (
        <div className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6 mt-4">
          <h2 className="mb-4 font-semibold text-brand-navy">{t("filtersAndSummary")}</h2>
          <FinanceFiltersAndSummary
            filters={filters}
            summary={summary}
            onFilterChange={setFilters}
            onLoadDashboard={() => loadDashboard()}
            onExportCsv={exportCsv}
            loading={loading}
          />
        </div>
      )}

      {activeSection === "reports" && (
        <div className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6 mt-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-brand-navy/10 p-2">
              <FileDown className="h-5 w-5 text-brand-navy" />
            </div>
            <div>
              <h2 className="font-semibold text-brand-navy">{t("financeReportsTab")}</h2>
              <p className="text-xs text-brand-navy/60">{t("financeReportsDesc")}</p>
            </div>
          </div>
          <FinanceReports />
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
              loadDashboard({ page: newPage })
            }}
          />
        </div>
      )}
    </div>
  )
}

export default AdminFinanceControl
