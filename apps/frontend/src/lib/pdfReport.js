import { jsPDF } from "jspdf"
import { uiLocale } from "./locale.js"

/** Shared look of every printable report (finance, attendance…). */
export const NAVY = [15, 43, 94]
export const MUTED = [100, 112, 135]
export const TABLE_STYLE = {
  styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
  alternateRowStyles: { fillColor: [245, 247, 251] },
  margin: { left: 14, right: 14 },
}

export function formatDay(iso) {
  if (!iso) return "–"
  return new Date(iso).toLocaleDateString(uiLocale(), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })
}

/** "Du … au …", "À partir du …", "Jusqu'au …" or "all" — keys are passed in. */
export function rangeLabel({ startDate, endDate } = {}, t, keys) {
  if (startDate && endDate) return t(keys.range, { start: formatDay(startDate), end: formatDay(endDate) })
  if (startDate) return t(keys.from, { start: formatDay(startDate) })
  if (endDate) return t(keys.until, { end: formatDay(endDate) })
  return t(keys.all)
}

/**
 * Landscape page with the school band, the report title, a subtitle line and
 * the generation date. Returns the document.
 */
export function startReportPdf({ school, title, subtitle, generatedAt, generatedLabel }) {
  const doc = new jsPDF({ orientation: "landscape" })
  const width = doc.internal.pageSize.getWidth()

  doc.setFillColor(...NAVY)
  doc.rect(0, 0, width, 28, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(school?.name ?? "EduHaiti", 14, 12)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  const { address, city } = school ?? {}
  // Skip the city when the address already names it ("Port-au-Prince, Haiti").
  const place = address && city && address.includes(city) ? address : [address, city].filter(Boolean).join(" · ")
  if (place) doc.text(place, 14, 19)
  doc.setFontSize(9)
  doc.text("EduHaiti", width - 14, 12, { align: "right" })

  doc.setTextColor(...NAVY)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text(title, 14, 40)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(subtitle, 14, 46)
  doc.text(generatedLabel(new Date(generatedAt).toLocaleString(uiLocale())), width - 14, 46, { align: "right" })
  return doc
}

/** Four summary boxes: [label, value, hint]. */
export function drawSummaryBoxes(doc, boxes, top = 52) {
  const width = doc.internal.pageSize.getWidth()
  const boxWidth = (width - 28 - 3 * 4) / 4
  boxes.forEach(([label, value, hint], index) => {
    const x = 14 + index * (boxWidth + 4)
    doc.setDrawColor(220, 226, 236)
    doc.roundedRect(x, top, boxWidth, 22, 2, 2, "S")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(label.toUpperCase(), x + 4, top + 6)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.setTextColor(...NAVY)
    doc.text(value, x + 4, top + 14)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    if (hint) doc.text(hint, x + 4, top + 19)
  })
}

/** Small muted note under the last table. */
export function drawNote(doc, text) {
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(text, 14, doc.lastAutoTable.finalY + 6)
}

/** Footer text and "page / pages" on every page. */
export function finishReportPdf(doc, footer) {
  const width = doc.internal.pageSize.getWidth()
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    const bottom = doc.internal.pageSize.getHeight() - 6
    doc.text(footer, 14, bottom)
    doc.text(`${page} / ${pages}`, width - 14, bottom, { align: "right" })
  }
  return doc
}
