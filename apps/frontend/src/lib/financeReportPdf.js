import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { uiLocale } from "./locale.js"

const NAVY = [15, 43, 94]
const MUTED = [100, 112, 135]
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

export function formatDay(iso) {
  if (!iso) return "–"
  return new Date(iso).toLocaleDateString(uiLocale(), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })
}

/** Descriptions carry technical details after ";" (base=…, discount=…): keep the human part. */
export const cleanDescription = (value) => (value ?? "").split(";")[0].trim() || "–"

export function periodLabel(filters, t) {
  const { startDate, endDate } = filters ?? {}
  if (startDate && endDate) return t("financePeriodRange", { start: formatDay(startDate), end: formatDay(endDate) })
  if (startDate) return t("financePeriodFrom", { start: formatDay(startDate) })
  if (endDate) return t("financePeriodUntil", { end: formatDay(endDate) })
  return t("financePeriodAll")
}

/**
 * Printable payments report: school header, period, four totals and the
 * detailed table, with page numbers. Returns the jsPDF document.
 */
export function buildFinanceReportPdf(report, t) {
  const doc = new jsPDF({ orientation: "landscape" })
  const width = doc.internal.pageSize.getWidth()

  doc.setFillColor(...NAVY)
  doc.rect(0, 0, width, 28, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(report.school?.name ?? "EduHaiti", 14, 12)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  const { address, city } = report.school ?? {}
  // Skip the city when the address already names it ("Port-au-Prince, Haiti").
  const place = address && city && address.includes(city) ? address : [address, city].filter(Boolean).join(" · ")
  if (place) doc.text(place, 14, 19)
  doc.setFontSize(9)
  doc.text("EduHaiti", width - 14, 12, { align: "right" })

  doc.setTextColor(...NAVY)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text(t("financeReportTitle"), 14, 40)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  const status = report.filters?.status ? ` · ${t(STATUS_KEYS[report.filters.status] ?? report.filters.status)}` : ""
  doc.text(`${periodLabel(report.filters, t)}${status}`, 14, 46)
  doc.text(t("financeReportGenerated", { date: new Date(report.generatedAt).toLocaleString(uiLocale()) }), width - 14, 46, { align: "right" })

  const boxes = [
    [t("financeTotalBilled"), formatHtg(report.totals.amountHtg), t("financePaymentsCount", { count: report.totals.count })],
    [t("financeCollected"), formatHtg(report.totals.paidAmountHtg), ""],
    [t("financeOutstanding"), formatHtg(report.totals.outstandingAmountHtg), ""],
    [t("financeOverdue"), String(report.totals.overdueCount), t("financeOverdueHint")],
  ]
  const boxWidth = (width - 28 - 3 * 4) / 4
  boxes.forEach(([label, value, hint], index) => {
    const x = 14 + index * (boxWidth + 4)
    doc.setDrawColor(220, 226, 236)
    doc.roundedRect(x, 52, boxWidth, 22, 2, 2, "S")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(label.toUpperCase(), x + 4, 58)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.setTextColor(...NAVY)
    doc.text(value, x + 4, 66)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    if (hint) doc.text(hint, x + 4, 71)
  })

  autoTable(doc, {
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
    styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 251] },
    columnStyles: { 5: { halign: "right" } },
    margin: { left: 14, right: 14 },
  })

  if (report.truncated) {
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(t("financeReportTruncated"), 14, doc.lastAutoTable.finalY + 6)
  }

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    const bottom = doc.internal.pageSize.getHeight() - 6
    doc.text(t("financeReportFooter"), 14, bottom)
    doc.text(`${page} / ${pages}`, width - 14, bottom, { align: "right" })
  }

  return doc
}
