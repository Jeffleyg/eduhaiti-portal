import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../../test/utils.jsx"

const auth = { token: "tok", user: { id: "u1", name: "Ana", enrollmentNumber: "E1" } }
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => auth }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

const pdf = {
  internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  text: vi.fn(),
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  line: vi.fn(),
  addImage: vi.fn(),
  save: vi.fn(),
  lastAutoTable: undefined,
}
vi.mock("jspdf", () => ({ jsPDF: vi.fn(() => pdf) }))
const autoTable = vi.fn()
vi.mock("jspdf-autotable", () => ({ default: (...a) => autoTable(...a) }))
const qr = { toDataURL: vi.fn(async () => "data:image/png;base64,QR") }
vi.mock("qrcode", () => ({ toDataURL: (...a) => qr.toDataURL(...a) }))

import { apiFetch } from "../../lib/api.js"
import StudentTranscript from "./StudentTranscript.jsx"

const report = (grades) => ({ grades })
const routes = (overrides = {}) =>
  apiFetch.mockImplementation(async (path) => {
    if (path in overrides) {
      const v = overrides[path]
      if (v instanceof Error) throw v
      return v
    }
    if (path === "/grades/my-grades") return []
    const issued = path.match(/^\/grades\/transcript\/(\w+)\/issue$/)
    if (issued) return { scorecardId: `card-${issued[1]}` }
    if (path === "/grades/my-academic-years") return [{ id: "y1", year: "2025" }, { id: "y2", year: "2026", isActive: true }]
    if (path === "/grades/report/y2")
      return report([
        { id: "g1", score: 18, maxScore: 20, discipline: { name: "Math" }, class: { name: "3e" } },
        { id: "g2", score: 16, maxScore: 20 },
      ])
    if (path === "/grades/report/y1") return report([{ id: "g3", score: 13, maxScore: 20 }])
    return report([{ id: "g4", score: 5 }])
  })

beforeEach(() => {
  apiFetch.mockReset()
  Object.values(pdf).forEach((fn) => typeof fn === "function" && fn.mockClear?.())
  pdf.lastAutoTable = undefined
  autoTable.mockClear()
  qr.toDataURL.mockClear()
  auth.user = { id: "u1", name: "Ana", enrollmentNumber: "E1" }
})

describe("StudentTranscript", () => {
  it("shows the transcript for the active year with stats, remarks and QR", async () => {
    routes()
    renderWithRouter(<StudentTranscript />)
    expect(await screen.findByText("Année Académique 2026")).toBeInTheDocument()
    expect(screen.getByText("17.00/20")).toBeInTheDocument()
    expect(screen.getByText("85.0%")).toBeInTheDocument()
    expect(screen.getAllByText("Admis(e)")).toHaveLength(2)
    expect(screen.getByText(/Excellent rendement/)).toBeInTheDocument()
    expect(screen.getByAltText("verificationQrCode")).toHaveAttribute("src", "data:image/png;base64,QR")
    // The QR points to the public verification page of the issued record.
    expect(screen.getByText("card-y2")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/grades/transcript/y2/issue", { method: "POST", token: "tok" })
    expect(qr.toDataURL).toHaveBeenCalledWith(`${window.location.origin}/verify-transcript/card-y2`, { width: 200 })
  })

  it("switches years and shows other remarks", async () => {
    routes()
    renderWithRouter(<StudentTranscript />)
    await screen.findByText("Année Académique 2026")
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "y1" } })
    expect(await screen.findByText(/Rendement académique satisfaisant/)).toBeInTheDocument()
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "y3" } })
    expect(await screen.findByText(/Rendement académique à améliorer/)).toBeInTheDocument()
    expect(screen.getByText("Non admis(e)")).toBeInTheDocument()

    apiFetch.mockRejectedValueOnce(new Error("report error"))
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "y1" } })
    expect(await screen.findByText("report error")).toBeInTheDocument()
  })

  it("generates the professional PDF", async () => {
    routes()
    renderWithRouter(<StudentTranscript />)
    await screen.findByText("Année Académique 2026")
    pdf.lastAutoTable = { finalY: 120 }
    await userEvent.click(screen.getByText("PDF"))
    await waitFor(() => expect(pdf.save).toHaveBeenCalledWith("Releve_de_Notes_2026.pdf"))
    expect(autoTable.mock.calls[0][1].body).toEqual([
      ["Math", "3e", "18/20", "90.0%", "Admis(e)"],
      ["-", "-", "16/20", "80.0%", "Admis(e)"],
    ])
    expect(pdf.text).toHaveBeenCalledWith("Excellent rendement académique", 15, expect.any(Number), expect.any(Object))
    expect(pdf.addImage).toHaveBeenCalled()
  })

  it("covers PDF remarks for average and weak results and missing data", async () => {
    auth.user = { email: "a@x" }
    routes({
      "/grades/report/y2": report([{ id: "a", score: 13, maxScore: 20 }]),
      "/grades/report/y1": report([{ id: "b" }]),
    })
    renderWithRouter(<StudentTranscript />)
    await screen.findByText("Année Académique 2026")
    await userEvent.click(screen.getByText("PDF"))
    await waitFor(() => expect(pdf.text).toHaveBeenCalledWith("Rendement académique satisfaisant", 15, expect.any(Number), expect.any(Object)))

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "y1" } })
    await screen.findByText("0/20")
    await userEvent.click(screen.getByText("PDF"))
    await waitFor(() => expect(pdf.text).toHaveBeenCalledWith("Rendement académique à améliorer", 15, expect.any(Number), expect.any(Object)))
  })

  it("handles empty reports and PDF errors", async () => {
    routes({ "/grades/report/y2": {} })
    renderWithRouter(<StudentTranscript />)
    await screen.findByText("Année Académique 2026")
    expect(screen.getByText("0/20")).toBeInTheDocument()
    await userEvent.click(screen.getByText("PDF"))
    await waitFor(() => expect(pdf.save).toHaveBeenCalled())

    pdf.save.mockImplementationOnce(() => {
      throw new Error("pdf failed")
    })
    await userEvent.click(screen.getByText("PDF"))
    expect(await screen.findByText("pdf failed")).toBeInTheDocument()
  })

  it("requires a report before generating the PDF", async () => {
    routes({ "/grades/report/y2": null })
    renderWithRouter(<StudentTranscript />)
    await screen.findByText("Année Académique 2026")
    await userEvent.click(screen.getByText("PDF"))
    expect(await screen.findByText("transcriptYearRequired")).toBeInTheDocument()
  })

  it("uses the first year without an active one, prints, and handles QR and load errors", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    qr.toDataURL.mockRejectedValueOnce(new Error("qr failed"))
    routes({ "/grades/my-academic-years": [{ id: "y1", year: "2025" }] })
    const first = renderWithRouter(<StudentTranscript />)
    expect(await screen.findByText("Année Académique 2025")).toBeInTheDocument()
    expect(error).toHaveBeenCalledWith("Erro ao emitir histórico verificável:", expect.any(Error))
    await userEvent.click(screen.getByText("print"))
    expect(print).toHaveBeenCalled()
    first.unmount()

    routes({ "/grades/my-academic-years": null, "/grades/my-grades": null })
    const second = renderWithRouter(<StudentTranscript />)
    expect(await screen.findByText("transcriptPageTitle")).toBeInTheDocument()
    expect(screen.getByText("PDF").closest("button")).toBeDisabled()
    second.unmount()

    routes({ "/grades/my-academic-years": new Error("load failed") })
    renderWithRouter(<StudentTranscript />)
    expect(await screen.findByText("load failed")).toBeInTheDocument()
  })

  it("does not issue or print a QR for a year without published grades", async () => {
    routes({ "/grades/report/y2": { grades: [] } })
    renderWithRouter(<StudentTranscript />)
    await screen.findByText("Année Académique 2026")
    expect(screen.queryByAltText("verificationQrCode")).toBeNull()
    expect(apiFetch.mock.calls.some(([path]) => path.includes("/issue"))).toBe(false)
    await userEvent.click(screen.getByText("PDF"))
    await waitFor(() => expect(pdf.save).toHaveBeenCalled())
    expect(pdf.addImage).not.toHaveBeenCalled()
    expect(pdf.text).toHaveBeenCalledWith(
      "Document généré automatiquement (aucune note publiée : non vérifiable).",
      15,
      expect.any(Number),
      expect.any(Object),
    )
  })

  it("shows the loader", () => {
    apiFetch.mockImplementation(() => new Promise(() => {}))
    renderWithRouter(<StudentTranscript />)
    expect(screen.getByText("loading")).toBeInTheDocument()
  })
})
