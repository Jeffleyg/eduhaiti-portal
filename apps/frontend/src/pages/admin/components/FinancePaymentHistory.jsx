import DataTablePaginated from "../../../components/DataTablePaginated.jsx"
import Button from "../../../components/Button.jsx"
import { useTranslation } from "react-i18next"
import { Calendar, DollarSign, FileCheck } from "lucide-react"
import { sanitizeText, maskName } from "../../../lib/string.js"

function FinancePaymentHistory({ payments, loading, pagination, onPageChange }) {
  const { t } = useTranslation()
  const columns = [
    { key: "student", label: t("student") },
    { key: "enrollment", label: t("enrollmentLabel") },
    { key: "amount", label: t("amountLabel") },
    { key: "status", label: t("status") },
    { key: "dueDate", label: t("dueDate") },
    { key: "paidDate", label: t("paidDate") },
  ]

  const rows = (payments ?? []).map((payment) => {
    const statusColors = {
      PENDING: "bg-yellow-100 text-yellow-800",
      PARTIAL: "bg-blue-100 text-blue-800",
      PAID: "bg-emerald-100 text-emerald-800",
      OVERDUE: "bg-red-100 text-red-800",
    }

    return {
      id: payment.id,
      student: (
        <div>
          <p className="font-medium text-brand-navy">{maskName(payment.student?.name, "student")}</p>
          <p className="text-xs text-brand-navy/60">{sanitizeText(payment.student?.email ?? "—")}</p>
        </div>
      ),
      enrollment: payment.student?.enrollmentNumber || "—",
      amount: (
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-brand-navy/60" />
          <span className="font-semibold text-brand-navy">{Number(payment.amount).toFixed(2)}</span>
        </div>
      ),
        status: (
          <span className={`badge ${statusColors[payment.status] || "bg-gray-100 text-gray-800"}`}>
            {payment.status === "PENDING"
              ? t("paymentStatusPending")
              : payment.status === "PARTIAL"
                ? t("paymentStatusPartial")
                : payment.status === "PAID"
                  ? t("paymentStatusPaid")
                  : t("paymentStatusOverdue")}
          </span>
        ),
      dueDate: new Date(payment.dueDate).toLocaleDateString("pt-BR"),
      paidDate: payment.paidDate ? (
        <div className="flex items-center gap-1 text-emerald-700">
          <FileCheck className="h-3 w-3" />
          {new Date(payment.paidDate).toLocaleDateString("pt-BR")}
        </div>
      ) : (
        "—"
      ),
    }
  })

  return (
    <div className="space-y-4 module-card compact card-compact">
      <div>
        <h3 className="text-sm font-semibold text-brand-navy">{t("paymentHistory")}</h3>
        <p className="text-xs text-brand-navy/60">{t("totalPaymentsCount", { count: payments?.length || 0 })}</p>
      </div>

      <DataTablePaginated
        columns={columns}
        rows={rows}
        loading={loading && rows.length === 0}
        pageSize={10}
        totalCount={rows.length}
        emptyMessage={t("noPaymentsFound")}
      />

      {pagination?.totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={loading || pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            ← {t("previousPage")}
          </Button>
          <p className="text-xs text-brand-navy/70">
            {t("pageOf", { page: pagination.page, total: pagination.totalPages })}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            {t("nextPage")} →
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default FinancePaymentHistory
