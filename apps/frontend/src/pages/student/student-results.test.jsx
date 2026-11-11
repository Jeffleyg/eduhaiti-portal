import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../../test/utils.jsx"

const auth = { token: "tok", user: { name: "Ana" } }
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => auth }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

const pdf = { text: vi.fn(), setFontSize: vi.fn(), save: vi.fn(), lastAutoTable: undefined }
vi.mock("jspdf", () => ({ jsPDF: vi.fn(() => pdf) }))
const autoTable = vi.fn()
vi.mock("jspdf-autotable", () => ({ default: (...a) => autoTable(...a) }))

import { apiFetch } from "../../lib/api.js"
import StudentResults from "./StudentResults.jsx"

const years = [
  { id: "y1", year: "2025-2026" },
  { id: "y2", year: "2026-2027", isActive: true },
]

const routes = (overrides = {}) =>
  apiFetch.mockImplementation(async (path) => {
    if (path in overrides) {
      const v = overrides[path]
      if (v instanceof Error) throw v
      return v
    }
    if (path.startsWith("/grades/my-grades"))
      return [
        { score: 15, maxScore: 20, status: "PUBLISHED", discipline: { name: "Math" } },
        { score: 8, maxScore: 20, status: "DRAFT", subject: "Bio" },
      ]
    if (path === "/grades/my-academic-years") return years
    if (path.startsWith("/grades/evolution"))
      return {
        overallAverage: 11.5,
        timeline: [{ period: "2026-01", average: 12 }],
        byDiscipline: [{ disciplineId: "d1", disciplineName: "Math", average: 15 }],
      }
    if (path.startsWith("/grades/report"))
      return { grades: [{ score: 15, maxScore: 20, discipline: { name: "Math" }, class: { name: "3e" } }, { score: 10, maxScore: 20 }] }
    return null
  })

beforeEach(() => {
  apiFetch.mockReset()
  pdf.text.mockClear()
  pdf.save.mockClear()
  pdf.lastAutoTable = undefined
  autoTable.mockClear()
})

describe("StudentResults", () => {
  it("defaults to the active year and shows grades and evolution", async () => {
    routes()
    renderWithRouter(<StudentResults />)
    expect(await screen.findByText("15/20")).toBeInTheDocument()
    expect(screen.getByText("gradePublished")).toBeInTheDocument()
    expect(screen.getByText("gradeDraft")).toBeInTheDocument()
    expect(screen.getByText("Media geral no periodo: 11.50/20")).toBeInTheDocument()
    expect(screen.getByText("12.00/20")).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toHaveValue("y2")
    expect(apiFetch).toHaveBeenCalledWith("/grades/evolution?academicYearId=y2", { token: "tok" })
  })

  it("switches years, including 'all years'", async () => {
    routes()
    renderWithRouter(<StudentResults />)
    await screen.findByText("15/20")
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "y1" } })
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/grades/my-grades?academicYearId=y1", { token: "tok" }))
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } })
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/grades/evolution", { token: "tok" }))
    expect(screen.getByText("downloadTranscriptPdf")).toBeDisabled()
  })

  it("falls back to empty evolution and reports switch errors", async () => {
    routes({ "/grades/evolution?academicYearId=y1": null, "/grades/my-grades?academicYearId=y1": null })
    renderWithRouter(<StudentResults />)
    await screen.findByText("15/20")
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "y1" } })
    expect(await screen.findByText("timelineEmpty")).toBeInTheDocument()
    expect(screen.getByText("averageBySubjectEmpty")).toBeInTheDocument()

    apiFetch.mockRejectedValueOnce(new Error("switch error"))
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "y2" } })
    expect(await screen.findByText("switch error")).toBeInTheDocument()
  })

  it("generates the transcript PDF", async () => {
    routes()
    renderWithRouter(<StudentResults />)
    await screen.findByText("15/20")
    pdf.lastAutoTable = { finalY: 80 }
    await userEvent.click(screen.getByText("downloadTranscriptPdf"))
    await waitFor(() => expect(pdf.save).toHaveBeenCalledWith("historico-2026-2027.pdf"))
    expect(autoTable.mock.calls[0][1].body).toEqual([
      ["Math", "3e", "15/20", "75.0%"],
      ["-", "-", "10/20", "50.0%"],
    ])
    expect(pdf.text).toHaveBeenCalledWith("student: Ana", 14, 25)
    expect(pdf.text).toHaveBeenCalledWith("average: 12.50/20", 14, 90)
  })

  it("handles empty reports, unknown years and PDF errors", async () => {
    auth.user = null
    routes({ "/grades/report/y2": {} })
    renderWithRouter(<StudentResults />)
    await screen.findByText("15/20")
    await userEvent.click(screen.getByText("downloadTranscriptPdf"))
    await waitFor(() => expect(pdf.save).toHaveBeenCalled())
    expect(pdf.text).toHaveBeenCalledWith("average: 0.00/20", 14, 60)

    apiFetch.mockRejectedValueOnce(new Error("report error"))
    await userEvent.click(screen.getByText("downloadTranscriptPdf"))
    expect(await screen.findByText("report error")).toBeInTheDocument()
    auth.user = { name: "Ana" }
  })

  it("uses the first year when none is active and handles empty/failed loads", async () => {
    routes({ "/grades/my-academic-years": [{ id: "y9" }] })
    const first = renderWithRouter(<StudentResults />)
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("y9"))
    pdf.lastAutoTable = undefined
    await userEvent.click(screen.getByText("downloadTranscriptPdf"))
    await waitFor(() => expect(pdf.save).toHaveBeenCalledWith("historico-academico.pdf"))
    expect(pdf.text).toHaveBeenCalledWith("academicYear: -", 14, 31)
    first.unmount()

    routes({ "/grades/my-academic-years": null, "/grades/my-grades": null })
    const second = renderWithRouter(<StudentResults />)
    expect(await screen.findAllByText("noData")).toHaveLength(1)
    second.unmount()

    routes({ "/grades/my-academic-years": new Error("load error") })
    renderWithRouter(<StudentResults />)
    expect(await screen.findByText("load error")).toBeInTheDocument()
  })

  it("shows the loader", () => {
    apiFetch.mockImplementation(() => new Promise(() => {}))
    renderWithRouter(<StudentResults />)
    expect(screen.getByText("loading")).toBeInTheDocument()
  })
})
