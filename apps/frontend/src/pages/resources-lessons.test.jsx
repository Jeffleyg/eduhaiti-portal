import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../test/utils.jsx"

vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: "tok" }) }))
const survival = { disableImages: false }
vi.mock("../context/useSurvivalMode.js", () => ({ useSurvivalMode: () => survival }))
vi.mock("../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))
const offline = { list: [], save: vi.fn(), remove: vi.fn() }
vi.mock("../offline/offlineAssetLibrary.js", () => ({
  listOfflineAssets: () => offline.list,
  saveAssetOffline: (...a) => offline.save(...a),
  removeOffline: (...a) => offline.remove(...a),
}))

import { apiFetch } from "../lib/api.js"
import StudentResources from "./student/StudentResources.jsx"
import ProfessorLessonPlans from "./professor/ProfessorLessonPlans.jsx"

beforeEach(() => {
  apiFetch.mockReset()
  survival.disableImages = false
  offline.list = []
  offline.save = vi.fn()
  offline.remove = vi.fn()
})

describe("StudentResources", () => {
  const resources = [
    { id: "r1", title: "Guide", description: "desc", fileType: "PDF", filePath: "uploads/g.pdf", uploadedBy: { name: "T" } },
    { id: "r2", title: "Image", fileType: "png", filePath: "uploads/i.png" },
  ]
  const routes = () =>
    apiFetch.mockImplementation(async (path) => {
      if (path === "/classes/my-classes") return [{ id: "c1", series: { id: "se1" } }, { id: "c2" }]
      if (path === "/resources/class/c1") return resources
      if (path === "/resources/class/c2") return null
      if (path === "/resources/library/series/se1") return [{ id: "l1", title: "Library book", fileType: "pdf", filePath: "x" }, { id: "l1", title: "Library book", fileType: "pdf", filePath: "x" }]
      return []
    })

  it("lists class and library resources", async () => {
    routes()
    renderWithRouter(<StudentResources />)
    expect(await screen.findByText("Guide")).toBeInTheDocument()
    expect(screen.getByText("desc")).toBeInTheDocument()
    expect(screen.getAllByText("Library book")).toHaveLength(1)
    expect(screen.getAllByText("Download")[0]).toHaveAttribute("href", "http://localhost:3000/uploads/g.pdf")
    expect(screen.getAllByText("Salvar")).toHaveLength(2)
  })

  it("saves and removes resources offline", async () => {
    routes()
    offline.save.mockResolvedValueOnce([{ resourceId: "r1" }]).mockRejectedValueOnce(new Error("quota"))
    offline.remove.mockResolvedValueOnce([])
    vi.spyOn(console, "error").mockImplementation(() => {})
    renderWithRouter(<StudentResources />)
    await userEvent.click((await screen.findAllByText("Salvar"))[0])
    expect(await screen.findByText("resourceSavedOffline")).toBeInTheDocument()
    expect(offline.save).toHaveBeenCalledWith({ id: "r1", title: "Guide", fileType: "PDF", url: "http://localhost:3000/uploads/g.pdf" })
    await userEvent.click(screen.getByText("remove"))
    expect(await screen.findByText("resourceRemovedOffline")).toBeInTheDocument()
    await userEvent.click(screen.getAllByText("Salvar")[0])
    expect(await screen.findByText("offlineError")).toBeInTheDocument()
  })

  it("shows a saving indicator and text mode", async () => {
    routes()
    survival.disableImages = true
    offline.save.mockImplementation(() => new Promise(() => {}))
    renderWithRouter(<StudentResources />)
    expect(await screen.findAllByText("TXT")).not.toHaveLength(0)
    expect(screen.queryByText("desc")).toBeNull()
    expect(screen.getByText("textModeActive")).toBeInTheDocument()
    await userEvent.click(screen.getAllByText("Salvar")[0])
    expect(screen.getByText("...")).toBeInTheDocument()
  })

  it("handles students without classes and load errors", async () => {
    apiFetch.mockResolvedValueOnce([])
    const { unmount } = renderWithRouter(<StudentResources />)
    expect(await screen.findByText("noResourcesAvailable")).toBeInTheDocument()
    expect(screen.getByText("seriesLibraryEmpty")).toBeInTheDocument()
    unmount()
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    apiFetch.mockRejectedValueOnce(new Error("down"))
    renderWithRouter(<StudentResources />)
    await waitFor(() => expect(error).toHaveBeenCalled())
  })

  it("shows the loader", () => {
    apiFetch.mockImplementation(() => new Promise(() => {}))
    renderWithRouter(<StudentResources />)
    expect(screen.getByText("loading")).toBeInTheDocument()
  })
})

describe("ProfessorLessonPlans", () => {
  const routes = (overrides = {}) =>
    apiFetch.mockImplementation(async (path, options = {}) => {
      const key = `${options.method ?? "GET"} ${path}`
      if (key in overrides) {
        const v = overrides[key]
        if (v instanceof Error) throw v
        return typeof v === "function" ? v() : v
      }
      if (path === "/classes/my-classes") return [{ id: "c1", name: "3e" }, { id: "c2", name: "4e" }]
      if (path.startsWith("/lessons?classId=c1"))
        return [{ id: "p1", title: "Plan A", date: "2026-01-01", objectives: "obj", methodology: "PBL", content: "act", tags: ["math"] }]
      if (path.startsWith("/lessons?classId=c2")) return null
      if (path.startsWith("/lessons/repository"))
        return [{ id: "x", title: "Shared", class: { name: "3e" }, createdBy: { name: "T" }, methodology: "Game", tags: ["fun"] }, { id: "y", title: "Bare" }]
      return {}
    })

  it("lists plans and the shared repository, with search and class change", async () => {
    routes()
    renderWithRouter(<ProfessorLessonPlans />)
    expect(await screen.findByText("Plan A")).toBeInTheDocument()
    expect(screen.getByText("Metodologia: PBL")).toBeInTheDocument()
    expect(screen.getByText("Tags: math")).toBeInTheDocument()
    expect(screen.getByText("Shared")).toBeInTheDocument()
    expect(screen.getByText("Turma: 3e | Autor: T")).toBeInTheDocument()
    expect(screen.getByText("Turma: - | Autor: -")).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("searchPlansPlaceholder"), { target: { value: "game" } })
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/lessons/repository?q=game", { token: "tok" }))

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "c2" } })
    expect(await screen.findByText("noPlansFound")).toBeInTheDocument()
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "" } })
  })

  it("saves a plan and refreshes", async () => {
    routes({ "POST /lessons": {} })
    const { container } = renderWithRouter(<ProfessorLessonPlans />)
    await screen.findByText("Plan A")
    fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: "2026-02-01" } })
    fireEvent.change(screen.getByPlaceholderText("titleLabel"), { target: { value: "New plan" } })
    fireEvent.change(screen.getByPlaceholderText("objectives"), { target: { value: "o" } })
    fireEvent.change(screen.getByPlaceholderText("methodologyPlaceholder"), { target: { value: "m" } })
    fireEvent.change(screen.getByPlaceholderText("contentActivities"), { target: { value: "c" } })
    fireEvent.change(screen.getByPlaceholderText("tagsPlaceholder"), { target: { value: "a, , b" } })
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "CLASS" } })
    fireEvent.submit(screen.getByText("saveLessonPlan").closest("form"))
    expect(await screen.findByText("lessonPlanSaved")).toBeInTheDocument()
    expect(apiFetch.mock.calls.find((c) => c[1]?.method === "POST")[1].body).toEqual({
      classId: "c1",
      date: "2026-02-01",
      title: "New plan",
      objectives: "o",
      content: "c",
      methodology: "m",
      visibility: "CLASS",
      tags: ["a", "b"],
    })
  })

  it("falls back to local storage when the backend fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    routes({
      "GET /lessons?classId=c1": new Error("offline"),
      "POST /lessons": new Error("offline"),
      "GET /lessons/repository": new Error("offline"),
    })
    localStorage.setItem("lessonplans:c1", JSON.stringify([{ id: "l0", title: "Cached plan" }]))
    renderWithRouter(<ProfessorLessonPlans />)
    expect(await screen.findByText("Cached plan")).toBeInTheDocument()
    expect(screen.getByText("repositoryEmpty")).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText("titleLabel"), { target: { value: "Offline plan" } })
    fireEvent.submit(screen.getByText("saveLessonPlan").closest("form"))
    expect(await screen.findByText("lessonPlanSavedLocally")).toBeInTheDocument()
    expect(screen.getByText("Offline plan")).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem("lessonplans:c1"))).toHaveLength(2)
  })

  it("starts empty without classes and handles errors", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    routes({ "GET /classes/my-classes": null, "GET /lessons/repository": null })
    const { unmount } = renderWithRouter(<ProfessorLessonPlans />)
    expect(await screen.findByText("noPlansFound")).toBeInTheDocument()
    unmount()
    routes({ "GET /classes/my-classes": new Error("down") })
    renderWithRouter(<ProfessorLessonPlans />)
    await waitFor(() => expect(error).toHaveBeenCalled())
  })

  it("uses an empty local cache when nothing is stored", async () => {
    routes({ "GET /lessons?classId=c1": new Error("offline"), "POST /lessons": new Error("offline") })
    renderWithRouter(<ProfessorLessonPlans />)
    expect(await screen.findByText("noPlansFound")).toBeInTheDocument()
    fireEvent.submit(screen.getByText("saveLessonPlan").closest("form"))
    expect(await screen.findByText("lessonPlanSavedLocally")).toBeInTheDocument()
  })

  it("refreshes with a null response after saving", async () => {
    let lessonsCalls = 0
    routes({
      "POST /lessons": {},
      "GET /lessons?classId=c1": () => (lessonsCalls++ === 0 ? [{ id: "p1", title: "Plan A" }] : null),
    })
    renderWithRouter(<ProfessorLessonPlans />)
    await screen.findByText("Plan A")
    fireEvent.submit(screen.getByText("saveLessonPlan").closest("form"))
    expect(await screen.findByText("noPlansFound")).toBeInTheDocument()
  })

  it("shows the loader", () => {
    apiFetch.mockImplementation(() => new Promise(() => {}))
    renderWithRouter(<ProfessorLessonPlans />)
    expect(screen.getByText("common.loading")).toBeInTheDocument()
  })
})
