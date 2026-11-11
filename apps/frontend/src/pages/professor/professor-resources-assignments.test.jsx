import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../../test/utils.jsx"

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: "tok" }) }))
const survival = { disableImages: false }
vi.mock("../../context/useSurvivalMode.js", () => ({ useSurvivalMode: () => survival }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn(), apiUpload: vi.fn() }))

import { apiFetch, apiUpload } from "../../lib/api.js"
import ProfessorResources from "./ProfessorResources.jsx"
import ProfessorAssignments from "./ProfessorAssignments.jsx"

beforeEach(() => {
  apiFetch.mockReset()
  apiUpload.mockReset()
  survival.disableImages = false
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("ProfessorResources", () => {
  const routes = () =>
    apiFetch.mockImplementation(async (path) => {
      if (path === "/classes/my-classes") return [{ id: "c1", name: "3e", series: { id: "se" } }, { id: "c2", name: "4e" }]
      if (path === "/resources/class/c1") return [{ id: "r1", title: "Slides", fileType: "pdf", filePath: "uploads/s.pdf" }]
      if (path === "/resources/class/c2") return null
      if (path === "/resources/library/series/se") return [{ id: "l1", title: "Book", class: { name: "3e" }, filePath: "b" }, { id: "l2", title: "Loose", filePath: "c" }]
      return []
    })

  it("lists class and library resources and switches classes", async () => {
    routes()
    renderWithRouter(<ProfessorResources />)
    expect(await screen.findByText("Slides")).toBeInTheDocument()
    expect(screen.getByText("PDF")).toBeInTheDocument()
    expect(screen.getByText("Turma: 3e")).toBeInTheDocument()
    expect(screen.getByText("Turma: -")).toBeInTheDocument()
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "c2" } })
    expect(await screen.findByText("noResourcesYet")).toBeInTheDocument()
  })

  it("uploads a resource", async () => {
    routes()
    apiUpload.mockResolvedValueOnce({})
    const { container } = renderWithRouter(<ProfessorResources />)
    await screen.findByText("Slides")
    const submit = screen.getByText("sendResource")
    expect(submit).toBeDisabled()
    fireEvent.submit(submit.closest("form"))
    expect(apiUpload).not.toHaveBeenCalled()

    fireEvent.change(screen.getByPlaceholderText("resourceTitleExample"), { target: { value: "Lesson" } })
    fireEvent.change(screen.getByPlaceholderText("materialDescription"), { target: { value: "Desc" } })
    const file = new File(["x"], "lesson.pdf", { type: "application/pdf" })
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } })
    expect(screen.getByText("lesson.pdf")).toBeInTheDocument()
    await userEvent.click(screen.getByText("sendResource"))
    await waitFor(() => expect(apiUpload).toHaveBeenCalled())
    const [path, options] = apiUpload.mock.calls[0]
    expect(path).toBe("/resources/upload/c1")
    expect(options.formData.get("title")).toBe("Lesson")
    expect(options.formData.get("file")).toBe(file)
    await waitFor(() => expect(screen.getByText("clickToUpload")).toBeInTheDocument())
  })

  it("logs upload and load failures, supports text mode", async () => {
    routes()
    survival.disableImages = true
    apiUpload.mockRejectedValueOnce(new Error("too big"))
    const { container } = renderWithRouter(<ProfessorResources />)
    expect(await screen.findByText("TXT-DOWNLOAD")).toBeInTheDocument()
    expect(screen.getByText("manageResourcesSubtitleTextMode")).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText("resourceTitleExample"), { target: { value: "L" } })
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(["x"], "a.pdf")] } })
    await userEvent.click(screen.getByText("sendResource"))
    await waitFor(() => expect(console.error).toHaveBeenCalledWith("Upload failed:", expect.any(Error)))

    apiFetch.mockRejectedValueOnce(new Error("load"))
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "c2" } })
    await waitFor(() => expect(console.error).toHaveBeenCalledWith("Failed to fetch resources:", expect.any(Error)))
  })

  it("handles teachers without classes and initial errors", async () => {
    apiFetch.mockResolvedValueOnce(null)
    const { unmount } = renderWithRouter(<ProfessorResources />)
    expect(await screen.findByText("noLibraryItems")).toBeInTheDocument()
    unmount()
    apiFetch.mockRejectedValueOnce(new Error("down"))
    renderWithRouter(<ProfessorResources />)
    await waitFor(() => expect(console.error).toHaveBeenCalledWith("Failed to fetch data:", expect.any(Error)))
  })

  it("shows the uploading label and the loader", async () => {
    routes()
    apiUpload.mockImplementation(() => new Promise(() => {}))
    const { container } = renderWithRouter(<ProfessorResources />)
    expect(screen.getByText("loading")).toBeInTheDocument()
    await screen.findByText("Slides")
    fireEvent.change(screen.getByPlaceholderText("resourceTitleExample"), { target: { value: "L" } })
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(["x"], "a.pdf")] } })
    await userEvent.click(screen.getByText("sendResource"))
    expect(screen.getByText("uploading")).toBeInTheDocument()
  })
})

describe("ProfessorAssignments", () => {
  const future = new Date(Date.now() + 86400000).toISOString()
  const routes = () =>
    apiFetch.mockImplementation(async (path) => {
      if (path === "/classes/my-classes") return [{ id: "c1", name: "3e", level: "A", academicYear: { year: "2026" } }, { id: "c2", name: "4e" }]
      if (path === "/assignments/class/c1")
        return [
          { id: "a1234567890", title: "Homework", description: "d", dueDate: future },
          { id: "b1234567890", title: "Late", dueDate: "2020-01-01", class: { name: "Other", level: "L" } },
        ]
      if (path === "/assignments/class/c2") return { not: "array" }
      return []
    })

  it("lists assignments of the teacher's classes", async () => {
    routes()
    renderWithRouter(<ProfessorAssignments />)
    expect(await screen.findByText("Homework")).toBeInTheDocument()
    expect(screen.getByText("Other")).toBeInTheDocument()
    expect(screen.getByText("ID: a1234567...")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/classes/my-classes", { token: "tok" })
  })

  it("validates and creates an assignment", async () => {
    routes()
    apiUpload.mockResolvedValueOnce({})
    const { container } = renderWithRouter(<ProfessorAssignments />)
    await screen.findByText("Homework")
    await userEvent.click(screen.getByText("assignments.newAssignment"))
    expect(screen.getByRole("option", { name: "3e (2026)" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "4e ()" })).toBeInTheDocument()
    fireEvent.submit(container.querySelector("form"))
    expect(await screen.findByText("assignments.validationError")).toBeInTheDocument()

    fireEvent.change(container.querySelector("select"), { target: { value: "c1" } })
    fireEvent.change(screen.getByPlaceholderText("assignmentTitleExample"), { target: { value: "Essay" } })
    fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: "2026-12-01" } })
    fireEvent.change(screen.getByPlaceholderText("assignmentInstructionsPlaceholder"), { target: { value: "Write" } })
    fireEvent.submit(container.querySelector("form"))
    expect(await screen.findByText("assignments.createSuccess")).toBeInTheDocument()
    const [path, options] = apiUpload.mock.calls[0]
    expect(path).toBe("/assignments/create/c1")
    expect(options.formData.get("title")).toBe("Essay")
    expect(options.formData.get("dueDate")).toBe(new Date("2026-12-01").toISOString())
  })

  it("shows creation errors with and without a message, and cancels", async () => {
    routes()
    apiUpload.mockRejectedValueOnce(new Error("server says no")).mockRejectedValueOnce(new Error(""))
    const { container } = renderWithRouter(<ProfessorAssignments />)
    await screen.findByText("Homework")
    await userEvent.click(screen.getByText("assignments.newAssignment"))
    fireEvent.change(container.querySelector("select"), { target: { value: "c1" } })
    fireEvent.change(screen.getByPlaceholderText("assignmentTitleExample"), { target: { value: "E" } })
    fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: "2026-12-01" } })
    fireEvent.submit(container.querySelector("form"))
    expect(await screen.findByText("server says no")).toBeInTheDocument()
    fireEvent.submit(container.querySelector("form"))
    expect(await screen.findByText("assignments.createError")).toBeInTheDocument()
    await userEvent.click(screen.getByText("common.cancel"))
    expect(screen.queryByText("assignments.createModalTitle")).toBeNull()
  })

  it("shows the saving label", async () => {
    routes()
    apiUpload.mockImplementation(() => new Promise(() => {}))
    const { container } = renderWithRouter(<ProfessorAssignments />)
    await screen.findByText("Homework")
    await userEvent.click(screen.getByText("assignments.newAssignment"))
    fireEvent.change(container.querySelector("select"), { target: { value: "c1" } })
    fireEvent.change(screen.getByPlaceholderText("assignmentTitleExample"), { target: { value: "E" } })
    fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: "2026-12-01" } })
    fireEvent.submit(container.querySelector("form"))
    expect(await screen.findByText("common.saving")).toBeInTheDocument()
  })

  it("shows empty and error states and refreshes", async () => {
    apiFetch.mockResolvedValueOnce(null)
    renderWithRouter(<ProfessorAssignments />)
    expect(await screen.findByText("assignments.teacherEmptyTitle")).toBeInTheDocument()
    apiFetch.mockRejectedValueOnce(new Error("down"))
    await userEvent.click(screen.getByText("common.refresh"))
    expect(await screen.findByText("common.errorLoading")).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText("closeMessage"))
    expect(screen.queryByText("common.errorLoading")).toBeNull()
  })
})
