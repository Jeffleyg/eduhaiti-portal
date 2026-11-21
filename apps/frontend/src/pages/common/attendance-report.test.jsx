import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

const auth = { token: "tok" }
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => auth }))
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
  getNumberOfPages: vi.fn(() => 1),
  setPage: vi.fn(),
  save: vi.fn(),
}
const autoTable = vi.fn()
vi.mock("jspdf", () => ({ jsPDF: vi.fn(() => pdf) }))
vi.mock("jspdf-autotable", () => ({ default: (...a) => autoTable(...a) }))

import { apiFetch, apiFetchRaw } from "../../lib/api.js"
import { presetRange } from "../../lib/download.js"
import { trendBuckets } from "../../lib/attendanceTrend.js"
import { attendancePeriodLabel, buildAttendanceReportPdf, percent } from "../../lib/attendanceReportPdf.js"
import AttendanceReport from "./AttendanceReport.jsx"

const t = (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key)
const student = (over) => ({
  studentId: "s1",
  name: "Jean Dupont",
  enrollmentNumber: "E1",
  classId: "c1",
  className: "3e A",
  records: 10,
  present: 9,
  late: 1,
  excused: 0,
  absent: 0,
  rate: 1,
  ...over,
})
const report = (over = {}) => ({
  generatedAt: "2026-11-21T12:00:00.000Z",
  school: { name: "Lycée", address: null, city: "Jacmel" },
  period: { startDate: "2026-10-23T00:00:00.000Z", endDate: "2026-11-21T23:59:59.999Z" },
  totals: { records: 30, present: 22, late: 2, excused: 1, absent: 5, rate: 0.8333, students: 3, classesWithoutRecords: 1 },
  daily: [
    { date: "2026-11-02", records: 10, rate: 0.9 },
    { date: "2026-11-03", records: 20, rate: 0.8 },
  ],
  classes: [
    { id: "c1", name: "3e A", level: "3e", teacherName: "Clair", students: 3, records: 30, present: 22, late: 2, excused: 1, absent: 5, rate: 0.8333 },
    { id: "c2", name: "3e B", level: "3e", teacherName: null, students: 1, records: 0, present: 0, late: 0, excused: 0, absent: 0, rate: null },
  ],
  students: [
    student({ studentId: "s3", name: "Paul", enrollmentNumber: null, rate: 0.5, absent: 5 }),
    student({ studentId: "s2", name: "Anne", className: null, rate: 0.7 }),
    student({ studentId: "s1" }),
    student({ studentId: "s4", name: null, rate: null, records: 0 }),
  ],
  ...over,
})

let click
beforeEach(() => {
  auth.token = "tok"
  apiFetch.mockReset()
  apiFetchRaw.mockReset()
  pdf.save.mockClear()
  pdf.text.mockClear()
  autoTable.mockClear()
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() })
  click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
})
afterEach(() => click.mockRestore())

describe("attendance helpers", () => {
  it("formats rates, periods and the last 30 days", () => {
    expect(percent(0.756)).toBe("76 %")
    expect(percent(null)).toBe("–")
    expect(percent(undefined)).toBe("–")
    expect(attendancePeriodLabel(null, t)).toBe("attendancePeriodAll")
    expect(attendancePeriodLabel({ startDate: "2026-11-01" }, t)).toMatch(/^financePeriodFrom/)
    expect(presetRange("last30", new Date("2026-11-21T10:00:00Z"))).toEqual({ startDate: "2026-10-23", endDate: "2026-11-21" })
  })

  it("keeps days for short periods and groups weeks for long ones", () => {
    expect(trendBuckets([{ date: "2026-11-02", records: 4, rate: 0.5 }])).toEqual([
      { key: "2026-11-02", start: "2026-11-02", records: 4, rate: 0.5 },
    ])
    const long = Array.from({ length: 50 }, (_, i) => {
      const date = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10)
      return { date, records: 2, rate: i === 0 ? null : 1 }
    })
    const weeks = trendBuckets(long)
    expect(weeks[0]).toMatchObject({ start: "2026-08-31", weekly: true })
    // 2026-09-01 has no rate: counted as 0 attended.
    expect(weeks[0].rate).toBeCloseTo(10 / 12)
    expect(weeks.every((w) => w.weekly)).toBe(true)
    expect(trendBuckets(Array.from({ length: 46 }, (_, i) => ({ date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, records: 0, rate: null })))[0].rate).toBeNull()
  })

  it("draws the PDF with or without the class table", () => {
    buildAttendanceReportPdf(report(), { scopeLabel: "attendanceAllClasses", t })
    expect(autoTable).toHaveBeenCalledTimes(2)
    expect(autoTable.mock.calls[0][1].body[1]).toEqual(["3e B", "–", "1", "0", "0", "attendanceNoRollCall"])
    expect(autoTable.mock.calls[1][1].startY).toBe(128)
    expect(autoTable.mock.calls[1][1].body[3]).toEqual(["–", "E1", "3e A", "9", "1", "0", "0", "–"])
    expect(pdf.text.mock.calls.map((c) => c[0])).toContain("Jacmel")

    autoTable.mockClear()
    buildAttendanceReportPdf(report({ classes: [report().classes[0]] }), { scopeLabel: "3e A", t })
    expect(autoTable).toHaveBeenCalledTimes(1)
    expect(autoTable.mock.calls[0][1].startY).toBe(80)
  })
})

describe("AttendanceReport page", () => {
  it("loads the last 30 days for all classes and shows every section", async () => {
    apiFetch.mockResolvedValue(report())
    render(<AttendanceReport />)
    expect(document.querySelector("[aria-busy=true]")).toBeInTheDocument()
    expect(await screen.findByText("attendanceByStudent")).toBeInTheDocument()
    expect(apiFetch.mock.calls[0][0]).toMatch(/^\/attendance\/report\?startDate=\d{4}-\d{2}-\d{2}&endDate=\d{4}-\d{2}-\d{2}T23%3A59%3A59.999Z$/)
    expect(screen.getAllByText("83 %").length).toBeGreaterThan(0)
    expect(screen.getByText("attendanceExcusedCount")).toBeInTheDocument()
    expect(screen.getByText("attendanceClassesWithoutRecords")).toBeInTheDocument()
    expect(screen.getByRole("table", { name: "attendanceTrend" })).toBeInTheDocument()
    expect(screen.getByText("attendanceNoRollCall")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "3e B" })).toBeInTheDocument()
    // Standing badges: critical, watch, regular, unknown.
    for (const key of ["attendanceCritical", "attendanceWatch", "attendanceRegular"]) {
      expect(screen.getAllByText(key).length).toBeGreaterThan(0)
    }
  })

  it("searches and filters the students", async () => {
    apiFetch.mockResolvedValue(report())
    render(<AttendanceReport />)
    await screen.findByText("attendanceByStudent")
    const table = () => screen.getAllByRole("table").at(-1)
    fireEvent.change(screen.getByPlaceholderText("attendanceSearch"), { target: { value: "anne" } })
    expect(within(table()).getByText("Anne")).toBeInTheDocument()
    expect(within(table()).queryByText("Paul")).toBeNull()
    fireEvent.change(screen.getByPlaceholderText("attendanceSearch"), { target: { value: "3e a" } })
    expect(within(table()).getByText("Paul")).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText("attendanceSearch"), { target: { value: "zzz" } })
    expect(screen.getByText("attendanceNoMatch")).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("attendanceSearch"), { target: { value: "" } })
    fireEvent.click(screen.getByRole("button", { name: "attendanceOnlyAlerts" }))
    expect(within(table()).getByText("Paul")).toBeInTheDocument()
    expect(within(table()).queryByText("Jean Dupont")).toBeNull()
  })

  it("narrows to one class from the table and keeps the class list", async () => {
    apiFetch.mockResolvedValueOnce(report()).mockResolvedValueOnce(report({ classes: [report().classes[0]] }))
    render(<AttendanceReport />)
    await screen.findByText("attendanceByClass")
    fireEvent.click(screen.getByRole("button", { name: "3e A" }))
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2))
    expect(apiFetch.mock.calls[1][0]).toMatch(/classId=c1/)
    await waitFor(() => expect(screen.queryByText("attendanceByClass")).toBeNull())
    expect(screen.queryByText("attendanceClassesWithoutRecords")).toBeNull()
    expect(screen.getByRole("option", { name: "3e B" })).toBeInTheDocument()
    expect(screen.getByLabelText("dashboardClass")).toHaveValue("c1")

    fireEvent.click(screen.getByRole("button", { name: "financePdfTitle" }))
    expect(pdf.save).toHaveBeenCalledWith(expect.stringMatching(/^rapport-presences-/))
    expect(pdf.text.mock.calls.some(([text]) => String(text).startsWith("3e A · "))).toBe(true)

    // Back to every class from the select.
    apiFetch.mockResolvedValueOnce(report())
    fireEvent.change(screen.getByLabelText("dashboardClass"), { target: { value: "" } })
    expect(await screen.findByText("attendanceByClass")).toBeInTheDocument()
  })

  it("exports the spreadsheet and reports failures", async () => {
    apiFetch.mockResolvedValue(report())
    apiFetchRaw
      .mockResolvedValueOnce({ blob: async () => new Blob(["x"]), headers: { get: () => 'attachment; filename="presences-2026-11-21.csv"' } })
      .mockResolvedValueOnce({ blob: async () => new Blob(["x"]), headers: { get: () => null } })
      .mockRejectedValueOnce(new Error("down"))
    render(<AttendanceReport />)
    await screen.findByText("attendanceByStudent")
    const csvButton = screen.getByRole("button", { name: "financeCsvTitle" })
    fireEvent.click(csvButton)
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    expect(click.mock.contexts[0].download).toBe("presences-2026-11-21.csv")
    expect(apiFetchRaw.mock.calls[0][0]).toMatch(/^\/attendance\/report\/export\?startDate=.*&lang=\w{2}$/)
    fireEvent.click(csvButton)
    await waitFor(() => expect(click).toHaveBeenCalledTimes(2))
    expect(click.mock.contexts[1].download).toBe("presences.csv")
    fireEvent.click(csvButton)
    expect(await screen.findByRole("alert")).toHaveTextContent("financeExportError")
  })

  it("shows the busy label while exporting", async () => {
    apiFetch.mockResolvedValue(report())
    apiFetchRaw.mockReturnValue(new Promise(() => {}))
    render(<AttendanceReport />)
    await screen.findByText("attendanceByStudent")
    fireEvent.click(screen.getByRole("button", { name: "financeCsvTitle" }))
    expect(await screen.findByRole("button", { name: "loading" })).toBeDisabled()
  })

  it("handles empty periods, custom ranges and load errors", async () => {
    apiFetch.mockResolvedValue(report())
    apiFetch.mockResolvedValueOnce(report({ totals: { ...report().totals, records: 0, excused: 0, classesWithoutRecords: 0 }, students: [], daily: [] }))
    render(<AttendanceReport />)
    expect(await screen.findByText("attendanceNoRecords")).toBeInTheDocument()
    expect(screen.queryByText("attendanceExcusedCount")).toBeNull()
    expect(screen.getByRole("button", { name: "financeCsvTitle" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "financePreset_custom" }))
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2))
    expect(apiFetch.mock.calls[1][0]).toBe("/attendance/report?")
    fireEvent.change(screen.getByLabelText("financeFrom"), { target: { value: "2026-11-10" } })
    fireEvent.change(screen.getByLabelText("financeTo"), { target: { value: "2026-11-01" } })
    expect(screen.getByRole("alert")).toHaveTextContent("financeInvalidRange")

    apiFetch.mockRejectedValueOnce(new Error("down"))
    fireEvent.change(screen.getByLabelText("financeTo"), { target: { value: "2026-11-30" } })
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("attendanceLoadError"))
    fireEvent.click(screen.getByRole("button", { name: "financePreset_month" }))
    fireEvent.click(screen.getByRole("button", { name: "financePreset_previousMonth" }))
    fireEvent.click(screen.getByRole("button", { name: "financePreset_schoolYear" }))
  })

  it("does nothing without a session and ignores late answers", async () => {
    auth.token = null
    const { unmount } = render(<AttendanceReport />)
    expect(apiFetch).not.toHaveBeenCalled()
    unmount()

    auth.token = "tok"
    let resolve
    apiFetch.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    const second = render(<AttendanceReport />)
    second.unmount()
    resolve(report())
    await Promise.resolve()

    let reject
    apiFetch.mockReturnValueOnce(new Promise((_, r) => (reject = r)))
    const third = render(<AttendanceReport />)
    third.unmount()
    reject(new Error("late"))
    await Promise.resolve()
  })
})
