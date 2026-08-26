import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import Button from "../../../components/Button.jsx"
import Input from "../../../components/Input.jsx"
import Select from "../../../components/Select.jsx"
import { FileDown, RotateCcw } from "lucide-react"

function FinanceFiltersAndSummary({ filters, summary, onFilterChange, onLoadDashboard, onExportCsv, loading }) {
  const { t } = useTranslation()
  const statusOptions = useMemo(
    () => [
      { value: "ALL", label: t("allStatuses") },
      { value: "PENDING", label: t("paymentStatusPending") },
      { value: "PARTIAL", label: t("paymentStatusPartial") },
      { value: "PAID", label: t("paymentStatusPaid") },
      { value: "OVERDUE", label: t("paymentStatusOverdue") },
    ],
    [t],
  )

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label className="text-sm font-medium text-brand-navy">{t("enrollmentLabel")}</label>
          <Input
            value={filters.studentEnrollmentNumber}
            onChange={(e) =>
              onFilterChange((prev) => ({ ...prev, studentEnrollmentNumber: e.target.value, page: 1 }))
            }
            placeholder={t("filterPlaceholder")}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-brand-navy">{t("status")}</label>
          <Select
            value={filters.status}
            onValueChange={(value) => onFilterChange((prev) => ({ ...prev, status: value, page: 1 }))}
            options={statusOptions}
            placeholder={t("allStatuses")}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-brand-navy">{t("startDate")}</label>
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange((prev) => ({ ...prev, startDate: e.target.value, page: 1 }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-brand-navy">{t("endDate")}</label>
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange((prev) => ({ ...prev, endDate: e.target.value, page: 1 }))}
          />
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          onClick={onLoadDashboard}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          {t("loadDashboard")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onExportCsv}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <FileDown className="h-4 w-4" />
          {t("exportCsv")}
        </Button>
      </div>

      {/* Resumo */}
      {summary ? (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">{t("totalCharges")}</p>
            <p className="mt-2 text-2xl font-bold text-emerald-900">{summary.totalPayments || 0}</p>
          </div>
          <div className="rounded-2xl border border-brand-navy/10 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-navy/60">{t("totalValue")}</p>
            <p className="mt-2 text-2xl font-bold text-brand-navy">
              {Number(summary.totalAmountHtg ?? 0).toFixed(2)}
              <span className="text-xs font-normal"> HTG</span>
            </p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{t("paidAmount")}</p>
            <p className="mt-2 text-2xl font-bold text-blue-900">
              {Number(summary.paidAmountHtg ?? 0).toFixed(2)}
              <span className="text-xs font-normal"> HTG</span>
            </p>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">{t("pendingAmount")}</p>
            <p className="mt-2 text-2xl font-bold text-orange-900">
              {Number((summary.totalAmountHtg ?? 0) - (summary.paidAmountHtg ?? 0)).toFixed(2)}
              <span className="text-xs font-normal"> HTG</span>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default FinanceFiltersAndSummary
