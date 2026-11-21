import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: "tok" }) }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn(), apiFetchRaw: vi.fn() }))

const pdf = {
  internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
  lastAutoTable: { finalY: 120 },
  setFillColor: vi.fn(),
  rect: vi.fn(),
  setTextColor: vi.fn(),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  text: vi.fn(),
  setDrawColor: vi.fn(),
  roundedRect: vi.fn(),
  getNumberOfPages: vi.fn(() => 2),
  setPage: vi.fn(),
  save: vi.fn(),
}
const autoTable = vi.fn()
vi.mock("jspdf", () => ({ jsPDF: vi.fn(() => pdf) }))
vi.mock("jspdf-autotable", () => ({ default: (...a) => autoTable(...a) }))

import { apiFetch, apiFetchRaw } from "../../lib/api.js"
import { downloadBlob, fileNameFrom, presetRange } from "../../lib/download.js"
import { buildFinanceReportPdf, cleanDescription, formatDay, formatHtg, periodLabel } from "../../lib/financeReportPdf.js"
import FinanceReports from "./components/FinanceReports.jsx"

const t = (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key)
const report = (over = {}) => ({
  generatedAt: "2026-11-21T12:00:00.000Z",
  school: { name: "Lycée Pétion", address: "Port-au-Prince, Haiti", city: "Port-au-Prince" },
  filters: { status: null, startDate: null, endDate: null },
  totals: { count: 2, amountHtg: 4000, paidAmountHtg: 2500, outstandingAmountHtg: 1500, overdueCount: 1 },
  byStatus: {},
  truncated: false,
  rows: [
    { id: "a", receiptNumber: "R1", studentName: "Jean", enrollmentNumber: "E1", amountHtg: 2500, status: "PAID", dueDate: "2026-09-05T12:00:00Z", paidDate: "2026-09-03T10:00:00Z", description: "Inscription; base=2500 HTG" },
    { id: "b", receiptNumber: null, studentName: null, enrollmentNumber: null, amountHtg: 1500, status: "WEIRD", dueDate: "2026-10-05T12:00:00Z", paidDate: null, description: null },
  ],
  ...over,
})

let click
beforeEach(() => {
  apiFetch.mockReset()
  apiFetchRaw.mockReset()
  Object.values(pdf).forEach((fn) => typeof fn === "function" && fn.mockClear?.())
  autoTable.mockClear()
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() })
  click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
})
afterEach(() => {
  click.mockRestore()
})

describe("download helpers", () => {
  it("computes preset ranges, including the September school year", () => {
    const nov = new Date("2026-11-21T12:00:00Z")
    expect(presetRange("month", nov)).toEqual({ startDate: "2026-11-01", endDate: "2026-11-30" })
    expect(presetRange("previousMonth", nov)).toEqual({ startDate: "2026-10-01", endDate: "2026-10-31" })
    expect(presetRange("schoolYear", nov)).toEqual({ startDate: "2026-09-01", endDate: "2027-08-31" })
    expect(presetRange("schoolYear", new Date("2027-03-10T00:00:00Z"))).toEqual({ startDate: "2026-09-01", endDate: "2027-08-31" })
    expect(presetRange("all", nov)).toEqual({ startDate: "", endDate: "" })
    expect(presetRange("month").startDate).toMatch(/^\d{4}-\d{2}-01$/)
  })

  it("reads the file name and saves blobs", () => {
    expect(fileNameFrom('attachment; filename="a.csv"', "x")).toBe("a.csv")
    expect(fileNameFrom(null, "x")).toBe("x")
    expect(fileNameFrom("inline", "x")).toBe("x")
    downloadBlob(new Blob(["1"]), "f.txt")
    expect(click.mock.contexts[0].download).toBe("f.txt")
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:x")
  })
})

describe("finance report PDF", () => {
  it("formats amounts, days, descriptions and periods", () => {
    expect(formatHtg(1500)).toMatch(/^1\D?500 HTG$/)
    expect(formatHtg(1500)).not.toMatch(new RegExp("[\u202f\u00a0]"))
    expect(formatDay(null)).toBe("–")
    expect(formatDay("2026-09-05T12:00:00Z")).toMatch(/2026/)
    expect(cleanDescription("Mensualité; base=1")).toBe("Mensualité")
    expect(cleanDescription(null)).toBe("–")
    expect(cleanDescription(" ; x")).toBe("–")
    expect(periodLabel({ startDate: "2026-09-01", endDate: "2026-09-30" }, t)).toMatch(/^financePeriodRange/)
    expect(periodLabel({ startDate: "2026-09-01" }, t)).toMatch(/^financePeriodFrom/)
    expect(periodLabel({ endDate: "2026-09-30" }, t)).toMatch(/^financePeriodUntil/)
    expect(periodLabel({}, t)).toBe("financePeriodAll")
    expect(periodLabel(null, t)).toBe("financePeriodAll")
  })

  it("draws header, totals, table and page numbers", () => {
    buildFinanceReportPdf(report({ filters: { status: "PENDING", startDate: "2026-09-01", endDate: null } }), t)
    const texts = pdf.text.mock.calls.map((c) => c[0])
    expect(texts).toContain("Lycée Pétion")
    // City is not repeated when the address already contains it.
    expect(texts).toContain("Port-au-Prince, Haiti")
    expect(texts.some((x) => String(x).endsWith("· paymentStatusPending"))).toBe(true)
    expect(texts).toContain("1 / 2")
    expect(texts).toContain("2 / 2")
    const table = autoTable.mock.calls[0][1]
    expect(table.body[0]).toEqual([formatDay("2026-09-05T12:00:00Z"), "Jean", "E1", "Inscription", "paymentStatusPaid", formatHtg(2500), formatDay("2026-09-03T10:00:00Z"), "R1"])
    expect(table.body[1].slice(1, 5)).toEqual(["–", "–", "–", "WEIRD"])
    expect(texts).not.toContain("financeReportTruncated")
  })

  it("handles a missing school, other addresses, unknown filter status and truncation", () => {
    buildFinanceReportPdf(report({ school: null, filters: { status: "ODD" }, truncated: true }), t)
    let texts = pdf.text.mock.calls.map((c) => c[0])
    expect(texts).toContain("EduHaiti")
    expect(texts).toContain("financeReportTruncated")
    expect(texts.some((x) => String(x).endsWith("· ODD"))).toBe(true)

    pdf.text.mockClear()
    buildFinanceReportPdf(report({ school: { name: "S", address: "Rue 1", city: "Jacmel" }, filters: undefined }), t)
    texts = pdf.text.mock.calls.map((c) => c[0])
    expect(texts).toContain("Rue 1 · Jacmel")

    pdf.text.mockClear()
    buildFinanceReportPdf(report({ school: { name: "S", address: null, city: null } }), t)
    expect(pdf.text.mock.calls.map((c) => c[0])).not.toContain("")
  })
})

describe("FinanceReports", () => {
  const panel = () => render(<FinanceReports />)

  it("downloads the spreadsheet for the chosen period and status", async () => {
    apiFetchRaw.mockResolvedValue({
      blob: async () => new Blob(["x"]),
      headers: { get: () => 'attachment; filename="paiements-2026-11-21.csv"' },
    })
    panel()
    expect(screen.getByRole("button", { name: "financePreset_schoolYear" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.change(screen.getByLabelText("status"), { target: { value: "OVERDUE" } })
    fireEvent.click(screen.getByRole("button", { name: "financeCsvAction" }))
    expect(await screen.findByRole("status")).toHaveTextContent("financeCsvReady")
    const url = apiFetchRaw.mock.calls[0][0]
    expect(url).toMatch(/^\/finance\/admin\/payments\/export\?startDate=\d{4}-09-01&endDate=\d{4}-08-31T23%3A59%3A59.999Z&status=OVERDUE&lang=\w{2}$/)
    expect(click.mock.contexts[0].download).toBe("paiements-2026-11-21.csv")

    apiFetchRaw.mockResolvedValueOnce({ blob: async () => new Blob(["x"]), headers: { get: () => null } })
    fireEvent.click(screen.getByRole("button", { name: "financePreset_all" }))
    fireEvent.click(screen.getByRole("button", { name: "financeCsvAction" }))
    await waitFor(() => expect(click).toHaveBeenCalledTimes(2))
    expect(click.mock.contexts[1].download).toBe("paiements.csv")
    expect(apiFetchRaw.mock.calls[1][0]).toMatch(/export\?status=OVERDUE&lang=/)
  })

  it("generates the PDF, or explains when the period is empty", async () => {
    apiFetch.mockResolvedValueOnce(report())
    panel()
    fireEvent.click(screen.getByRole("button", { name: "financePreset_month" }))
    fireEvent.click(screen.getByRole("button", { name: "financePdfAction" }))
    expect(await screen.findByRole("status")).toHaveTextContent("financePdfReady")
    expect(apiFetch.mock.calls[0][0]).toMatch(/^\/finance\/admin\/payments\/report\?startDate=\d{4}-\d{2}-01&endDate=/)
    expect(pdf.save).toHaveBeenCalledWith(expect.stringMatching(/^rapport-paiements-\d{4}-\d{2}-\d{2}\.pdf$/))

    apiFetch.mockResolvedValueOnce(report({ rows: [] }))
    fireEvent.click(screen.getByRole("button", { name: "financePdfAction" }))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("financeNothingToExport"))
    expect(pdf.save).toHaveBeenCalledTimes(1)

    apiFetch.mockResolvedValueOnce({})
    fireEvent.click(screen.getByRole("button", { name: "financePdfAction" }))
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("financeNothingToExport"))
  })

  it("validates a custom range and reports failures", async () => {
    apiFetchRaw.mockRejectedValue(new Error("down"))
    panel()
    fireEvent.click(screen.getByRole("button", { name: "financePreset_custom" }))
    fireEvent.change(screen.getByLabelText("financeFrom"), { target: { value: "2026-10-10" } })
    fireEvent.change(screen.getByLabelText("financeTo"), { target: { value: "2026-10-01" } })
    fireEvent.click(screen.getByRole("button", { name: "financeCsvAction" }))
    expect(screen.getByRole("alert")).toHaveTextContent("financeInvalidRange")
    expect(apiFetchRaw).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText("financeTo"), { target: { value: "2026-10-31" } })
    fireEvent.click(screen.getByRole("button", { name: "financeCsvAction" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("financeExportError")
    expect(apiFetchRaw.mock.calls[0][0]).toContain("startDate=2026-10-10")
  })

  it("checks the ledger and offers the auditor download", async () => {
    apiFetch.mockResolvedValueOnce({
      generatedAt: "2026-11-21T12:00:00.000Z",
      totalRecords: 6,
      integrity: { valid: true, brokenAtIndex: null },
      byCategory: { "tuition-charge": 4, "finance-audit-report": 2, unknown: 1 },
      lastHash: "89fc282427039a7d00112233",
      records: [],
    })
    panel()
    fireEvent.click(screen.getByRole("button", { name: "financePreset_all" }))
    fireEvent.click(screen.getByRole("button", { name: "financeAuditAction" }))
    expect(await screen.findByText("financeAuditValid")).toBeInTheDocument()
    expect(apiFetch.mock.calls[0][0]).toBe("/finance/admin/audit-report?limit=2000")
    expect(screen.getByText("ledger_tuition-charge · 4")).toBeInTheDocument()
    expect(screen.getByText("ledger_finance-audit-report · 2")).toBeInTheDocument()
    expect(screen.queryByText(/unknown/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "financeAuditDownload" }))
    expect(click.mock.contexts[0].download).toBe("audit-financier-2026-11-21.json")
  })

  it("flags a tampered ledger", async () => {
    apiFetch.mockResolvedValueOnce({
      generatedAt: "2026-11-21T12:00:00.000Z",
      totalRecords: 0,
      integrity: { valid: false, brokenAtIndex: 3 },
      byCategory: {},
      lastHash: "abc",
      records: [],
    })
    panel()
    fireEvent.click(screen.getByRole("button", { name: "financeAuditAction" }))
    expect(await screen.findByText("financeAuditBroken")).toBeInTheDocument()
    expect(apiFetch.mock.calls[0][0]).toMatch(/audit-report\?startDate=\d{4}-09-01&endDate=.*&limit=2000$/)
    expect(screen.queryByRole("list")).toBeNull()
  })

  it("shows a loading label while busy", async () => {
    apiFetch.mockReturnValue(new Promise(() => {}))
    panel()
    fireEvent.click(screen.getByRole("button", { name: "financeAuditAction" }))
    expect(await screen.findByRole("button", { name: "loading" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "financeCsvAction" })).toBeDisabled()
  })
})
