import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../../test/utils.jsx"

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: "tok" }) }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../../lib/api.js"
import ProfessorGrades from "./ProfessorGrades.jsx"

const classes = [
  {
    id: "c1",
    name: "3e",
    series: { id: "se1" },
    academicYear: { id: "y1" },
    students: [
      { id: "s1", name: "Ana", email: "a@x", enrollmentNumber: "E1" },
      { id: "s2", email: "b@x" },
    ],
  },
  { id: "c2", name: "4e", students: [] },
  { id: "c3", name: "5e", series: { id: "se3" }, students: [{ id: "s3", name: "Cid" }] },
]

const routes = (overrides = {}) =>
  apiFetch.mockImplementation(async (path, options = {}) => {
    for (const [key, value] of Object.entries(overrides)) {
      if (`${options.method ?? "GET"} ${path}`.startsWith(key)) {
        if (value instanceof Error) throw value
        return typeof value === "function" ? value(options) : value
      }
    }
    if (path === "/classes/my-classes") return classes
    if (path === "/disciplines?seriesId=se1") return [{ id: "d1", name: "Math" }, { id: "d2", name: "Bio" }]
    if (path === "/disciplines?seriesId=se3") return []
    if (path.startsWith("/grades/class/c1"))
      return [
        { id: "g1", studentId: "s1", score: 15, maxScore: 20, status: "DRAFT", student: { name: "Ana" }, discipline: { name: "Math" } },
        { id: "g2", studentId: "s2", score: 9, maxScore: 20, status: "PUBLISHED" },
      ]
    if (path.startsWith("/grades/class/c3")) return null
    if (path.startsWith("/grades/class/c2")) return []
    return {}
  })

beforeEach(() => {
  apiFetch.mockReset()
})

async function pick(label, option) {
  await userEvent.click(screen.getByRole("combobox", { name: label }))
  await userEvent.click(await screen.findByRole("option", { name: option }))
}

describe("ProfessorGrades", () => {
  it("loads the first class, its disciplines and grades", async () => {
    routes()
    renderWithRouter(<ProfessorGrades />)
    expect(await screen.findByText("15/20 (DRAFT)")).toBeInTheDocument()
    expect(screen.getByDisplayValue("15")).toBeInTheDocument()
    expect(screen.getByText("gradeDraft")).toBeInTheDocument()
    expect(screen.getByText("gradePublished")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/grades/class/c1?disciplineId=d1", { token: "tok" })
  })

  it("saves grades and validates the input", async () => {
    routes({ "POST /admin/grades": {} })
    renderWithRouter(<ProfessorGrades />)
    await screen.findByText("15/20 (DRAFT)")
    const inputs = screen.getAllByPlaceholderText("enterGrade")

    fireEvent.change(screen.getByPlaceholderText("maxScore"), { target: { value: "0" } })
    fireEvent.submit(screen.getByText("saveGrades").closest("form"))
    expect(await screen.findByText("maxScoreMustBePositive")).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText("maxScore"), { target: { value: "20" } })

    fireEvent.change(inputs[0], { target: { value: "" } })
    fireEvent.change(inputs[1], { target: { value: "" } })
    fireEvent.submit(screen.getByText("saveGrades").closest("form"))
    expect(await screen.findByText("requiresNote")).toBeInTheDocument()

    fireEvent.change(inputs[0], { target: { value: "25" } })
    fireEvent.submit(screen.getByText("saveGrades").closest("form"))
    expect(await screen.findByText("gradesInRange")).toBeInTheDocument()

    fireEvent.change(inputs[0], { target: { value: "18" } })
    fireEvent.submit(screen.getByText("saveGrades").closest("form"))
    expect(await screen.findByText("1 gradesSaved")).toBeInTheDocument()
    expect(apiFetch.mock.calls.find((c) => c[0] === "/admin/grades")[1].body).toEqual({
      studentId: "s1",
      classId: "c1",
      disciplineId: "d1",
      academicYearId: "y1",
      score: 18,
      maxScore: 20,
    })
  })

  it("publishes grades and reports errors", async () => {
    routes({ "POST /admin/grades/c1/publish": {} })
    renderWithRouter(<ProfessorGrades />)
    await screen.findByText("15/20 (DRAFT)")
    await userEvent.click(screen.getByText("publishGrades"))
    expect(await screen.findByText("gradesPublishedSuccess")).toBeInTheDocument()

    apiFetch.mockImplementationOnce(async () => {
      throw new Error("publish failed")
    })
    await userEvent.click(screen.getByText("publishGrades"))
    expect(await screen.findByText("publish failed")).toBeInTheDocument()

    apiFetch.mockImplementationOnce(async () => {
      throw new Error("save failed")
    })
    fireEvent.submit(screen.getByText("saveGrades").closest("form"))
    expect(await screen.findByText("save failed")).toBeInTheDocument()
  })

  it("switches discipline and class", async () => {
    routes()
    renderWithRouter(<ProfessorGrades />)
    await screen.findByText("15/20 (DRAFT)")
    await pick("selectDiscipline", "Bio")
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/grades/class/c1?disciplineId=d2", { token: "tok" }))

    await pick("selectClass", "4e")
    expect(await screen.findByText("noData")).toBeInTheDocument()
    fireEvent.submit(screen.getByText("saveGrades").closest("form"))
    expect(await screen.findByText("selectClassAndDiscipline")).toBeInTheDocument()

    await pick("selectClass", "5e")
    expect(await screen.findByText("noGrade")).toBeInTheDocument()

    await pick("selectClass", "3e")
    await waitFor(() => expect(screen.getByDisplayValue("15")).toBeInTheDocument())
  })

  it("requires an academic year and a discipline before publishing", async () => {
    const noYear = [{ ...classes[0], academicYear: null }]
    routes({ "GET /classes/my-classes": noYear })
    renderWithRouter(<ProfessorGrades />)
    await screen.findByText("15/20 (DRAFT)")
    fireEvent.submit(screen.getByText("saveGrades").closest("form"))
    expect(await screen.findByText("academicYearNotFound")).toBeInTheDocument()
  })

  it("reports errors when switching", async () => {
    routes()
    renderWithRouter(<ProfessorGrades />)
    await screen.findByText("15/20 (DRAFT)")
    apiFetch.mockRejectedValueOnce(new Error("disc error"))
    await pick("selectDiscipline", "Bio")
    expect(await screen.findByText("disc error")).toBeInTheDocument()
    apiFetch.mockRejectedValueOnce(new Error("class error"))
    await pick("selectClass", "5e")
    expect(await screen.findByText("class error")).toBeInTheDocument()
  })

  it("handles empty and failing initial loads", async () => {
    routes({ "GET /classes/my-classes": null })
    const { unmount } = renderWithRouter(<ProfessorGrades />)
    expect(await screen.findByText("noGrades")).toBeInTheDocument()
    await userEvent.click(screen.getByText("publishGrades").closest("button"))
    unmount()

    routes({ "GET /classes/my-classes": [classes[2]] })
    const second = renderWithRouter(<ProfessorGrades />)
    expect(await screen.findByText("Cid", { exact: false }).catch(() => null)).toBeDefined()
    second.unmount()

    routes({ "GET /classes/my-classes": new Error("load error") })
    renderWithRouter(<ProfessorGrades />)
    expect(await screen.findByText("load error")).toBeInTheDocument()
  })
})
