import autoTable from "jspdf-autotable"
import { uiLocale } from "./locale.js"
import { drawNote, drawSummaryBoxes, finishReportPdf, formatDay, rangeLabel, startReportPdf, TABLE_STYLE } from "./pdfReport.js"

export { formatDay }

const STATUS_KEYS = {
  PENDING: "paymentStatusPending",
  PARTIAL: "paymentStatusPartial",
  PAID: "paymentStatusPaid",
  OVERDUE: "paymentStatusOverdue",
}

// Intl uses narrow / non-breaking spaces as thousands separators; jsPDF's
// built-in fonts cannot draw them.
const SPECIAL_SPACES = new RegExp("[\\u202f\\u00a0]", "g")

/** Amount + " HTG" in the UI language, e.g. "1 500 HTG". */
export function formatHtg(amount) {
  const text = new Intl.NumberFormat(uiLocale(), { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount)
  return `${text.replace(SPECIAL_SPACES, " ")} HTG`
}

/** Descriptions carry technical details after ";" (base=…, discount=…): keep the human part. */
export const cleanDescription = (value) => (value ?? "").split(";")[0].trim() || "–"

export function periodLabel(filters, t) {
  return rangeLabel(filters ?? {}, t, {
    range: "financePeriodRange",
    from: "financePeriodFrom",
    until: "financePeriodUntil",
    all: "financePeriodAll",
  })
}

/**
 * Printable payments report: school header, period, four totals and the
 * detailed table, with page numbers. Returns the jsPDF document.
 */
export function buildFinanceReportPdf(report, t) {
  const status = report.filters?.status ? ` · ${t(STATUS_KEYS[report.filters.status] ?? report.filters.status)}` : ""
  const doc = startReportPdf({
    school: report.school,
    title: t("financeReportTitle"),
    subtitle: `${periodLabel(report.filters, t)}${status}`,
    generatedAt: report.generatedAt,
    generatedLabel: (date) => t("financeReportGenerated", { date }),
  })

  drawSummaryBoxes(doc, [
    [t("financeTotalBilled"), formatHtg(report.totals.amountHtg), t("financePaymentsCount", { count: report.totals.count })],
    [t("financeCollected"), formatHtg(report.totals.paidAmountHtg), ""],
    [t("financeOutstanding"), formatHtg(report.totals.outstandingAmountHtg), ""],
    [t("financeOverdue"), String(report.totals.overdueCount), t("financeOverdueHint")],
  ])

  autoTable(doc, {
    ...TABLE_STYLE,
    startY: 80,
    head: [[t("financeColDue"), t("financeColStudent"), t("financeColEnrollment"), t("financeColDescription"), t("financeColStatus"), t("financeColAmount"), t("financeColPaid"), t("financeColReceipt")]],
    body: report.rows.map((row) => [
      formatDay(row.dueDate),
      row.studentName ?? "–",
      row.enrollmentNumber ?? "–",
      cleanDescription(row.description),
      t(STATUS_KEYS[row.status] ?? row.status),
      formatHtg(row.amountHtg),
      formatDay(row.paidDate),
      row.receiptNumber ?? "–",
    ]),
    columnStyles: { 5: { halign: "right" } },
  })

  if (report.truncated) drawNote(doc, t("financeReportTruncated"))
  return finishReportPdf(doc, t("financeReportFooter"))
}
