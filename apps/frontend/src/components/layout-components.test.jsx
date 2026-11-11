import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import i18n from "../i18n.js"

const auth = { user: null, logout: vi.fn() }
vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => auth }))

const survival = { disableImages: false, disableAnimations: false, isSurvivalMode: false, isLowBattery: false, is2G: false }
vi.mock("../context/useSurvivalMode.js", () => ({ useSurvivalMode: () => survival }))

const sync = {
  isSyncing: false,
  completedTasks: 0,
  totalTasks: 0,
  currentTask: "",
  lastRunAt: null,
  syncNow: vi.fn(),
  error: "",
  syncHistory: [],
  conflictStrategy: "lww",
  setConflictStrategy: vi.fn(),
  lastSyncConflicts: [],
}
vi.mock("../context/useSyncControl.js", () => ({ useSyncControl: () => sync }))

import AppShell from "./AppShell.jsx"
import Sidebar from "./Sidebar.jsx"
import TopBar from "./TopBar.jsx"
import CorporateHeader from "./CorporateHeader.jsx"
import LanguageSelector from "./LanguageSelector.jsx"
import ProfileCard from "./ProfileCard.jsx"
import DataTablePaginated from "./DataTablePaginated.jsx"
import SettingsForm from "./admin/SettingsForm.jsx"

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const inRouter = (ui, route = "/") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
      <LocationProbe />
    </MemoryRouter>,
  )

beforeEach(() => {
  Object.assign(auth, { user: null, logout: vi.fn(async () => {}) })
  Object.assign(survival, { disableImages: false, disableAnimations: false, isSurvivalMode: false, isLowBattery: false, is2G: false })
  Object.assign(sync, {
    isSyncing: false,
    completedTasks: 0,
    totalTasks: 0,
    currentTask: "",
    lastRunAt: null,
    syncNow: vi.fn(),
    error: "",
    syncHistory: [],
    conflictStrategy: "lww",
    setConflictStrategy: vi.fn(),
    lastSyncConflicts: [],
  })
})

describe("Sidebar", () => {
  it.each([
    ["owner", "controlPanel", "roleowner"],
    ["admin", "adminClasses", "roleadmin"],
    ["teacher", "lessonPlansTitle", "roleprofessor"],
    ["professor", "navAcademicRequestsReview", "roleprofessor"],
    ["student", "navTranscript", "rolestudent"],
  ])("renders the %s navigation", (role, item, label) => {
    inRouter(<Sidebar role={role} />)
    expect(screen.getAllByText(item).length).toBeGreaterThan(0)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it("collapses and logs out", async () => {
    inRouter(<Sidebar role="student" />, "/student")
    await userEvent.click(screen.getByLabelText("Collapse sidebar"))
    expect(screen.queryByText("rolestudent")).toBeNull()
    await userEvent.click(screen.getByLabelText("Expand sidebar"))
    await userEvent.click(screen.getByTitle("logout"))
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/login"))
    expect(auth.logout).toHaveBeenCalled()
  })
})

describe("TopBar", () => {
  it("syncs, switches strategy and shows status", async () => {
    inRouter(<TopBar role="teacher" />)
    expect(screen.getByText("roleprofessor")).toBeInTheDocument()
    await userEvent.click(screen.getByText("syncNow"))
    expect(sync.syncNow).toHaveBeenCalledWith("teacher")
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "manual" } })
    expect(sync.setConflictStrategy).toHaveBeenCalledWith("manual")
    expect(screen.queryByText(/survivalMode/)).toBeNull()
  })

  it("shows syncing progress, errors, conflicts, history and survival reasons", () => {
    Object.assign(sync, {
      isSyncing: true,
      currentTask: "grades",
      error: "boom",
      lastSyncConflicts: [{}],
      lastRunAt: "2026-01-01T00:00:00Z",
      syncHistory: [
        { id: 1, createdAt: "2026-01-01T00:00:00Z", completedTasks: 1, totalTasks: 1, status: "success" },
        { id: 2, createdAt: "2026-01-01T00:00:00Z", completedTasks: 0, totalTasks: 1, status: "failed" },
      ],
    })
    Object.assign(survival, { isSurvivalMode: true, isLowBattery: true })
    const { rerender } = inRouter(<TopBar role="admin" />)
    expect(screen.getByText("syncProgress")).toBeInTheDocument()
    expect(screen.getByTitle("syncingTask: grades")).toBeDisabled()
    expect(screen.getByText("boom")).toBeInTheDocument()
    expect(screen.getByText("syncConflictsDetected")).toBeInTheDocument()
    expect(screen.getByText(/syncSuccess/)).toBeInTheDocument()
    expect(screen.getByText(/syncFailed/)).toBeInTheDocument()
    expect(screen.getByText("survivalMode: lowBattery")).toBeInTheDocument()

    Object.assign(survival, { isLowBattery: false, is2G: true })
    rerender(
      <MemoryRouter>
        <TopBar role="admin" />
      </MemoryRouter>,
    )
    expect(screen.getByText("survivalMode: slowNetwork")).toBeInTheDocument()
    Object.assign(survival, { is2G: false })
    rerender(
      <MemoryRouter>
        <TopBar role="admin" />
      </MemoryRouter>,
    )
    expect(screen.getByText("survivalMode:")).toBeInTheDocument()
  })

  it("navigates back", async () => {
    render(
      <MemoryRouter initialEntries={["/a", "/b"]} initialIndex={1}>
        <TopBar role="student" />
        <LocationProbe />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByTitle("back"))
    expect(screen.getByTestId("location")).toHaveTextContent("/a")
  })
})

describe("CorporateHeader", () => {
  it.each([
    ["ADMIN", "/admin/profile", "/admin/settings", "roleadmin"],
    ["TEACHER", "/teacher/profile", "/teacher/settings", "roleprofessor"],
    ["STUDENT", "/student/profile", "/student/settings", "rolestudent"],
    ["OWNER", "/owner/profile", "/owner/settings", "roleowner"],
    ["OTHER", "/change-password", "/change-password", "roleother"],
  ])("routes %s to profile and settings", async (role, profile, settings, label) => {
    auth.user = { role, name: "N", email: "e@x", enrollmentNumber: role === "STUDENT" ? "E1" : null }
    inRouter(<CorporateHeader />)
    expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    const toggle = screen.getAllByRole("button")[0]
    await userEvent.click(toggle)
    await userEvent.click(screen.getByText("profile"))
    expect(screen.getByTestId("location")).toHaveTextContent(profile)
    await userEvent.click(toggle)
    await userEvent.click(screen.getByText("settings"))
    expect(screen.getByTestId("location")).toHaveTextContent(settings)
  })

  it("shows the photo and logs out", async () => {
    auth.user = { role: "TEACHER", name: "T", profilePhoto: "/p.jpg", enrollmentNumber: "E" }
    inRouter(<CorporateHeader />, "/teacher")
    expect(screen.getByAltText("T")).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole("button")[0])
    expect(screen.getByText("E")).toBeInTheDocument()
    await userEvent.click(screen.getByText("logout"))
    expect(auth.logout).toHaveBeenCalled()
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/)
  })

  it("handles a missing user", async () => {
    auth.user = null
    inRouter(<CorporateHeader />)
    await userEvent.click(screen.getAllByRole("button")[0])
    expect(screen.getByText("-")).toBeInTheDocument()
  })

  it("shows the real name of a logged-in student", () => {
    auth.user = { role: "STUDENT", name: "S", profilePhoto: "/p.jpg" }
    inRouter(<CorporateHeader />)
    expect(screen.getByAltText("S")).toBeInTheDocument()
  })
})

describe("AppShell", () => {
  const renderShell = (route = "/student") =>
    render(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/student" element={<AppShell role="student" />}>
            <Route index element={<div>page-content</div>} />
            <Route path="other" element={<div>other-page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

  it("renders the outlet and toggles the mobile drawer", async () => {
    const { container } = renderShell()
    expect(screen.getByText("page-content")).toBeInTheDocument()
    expect(container.querySelector(".bg-atlas")).not.toBeNull()
    await userEvent.click(screen.getByText("Menu"))
    expect(document.body.style.overflow).toBe("hidden")
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" })))
    expect(document.body.style.overflow).toBe("hidden")
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })))
    expect(document.body.style.overflow).toBe("")

    await userEvent.click(screen.getByText("Menu"))
    await userEvent.click(screen.getByLabelText("Fechar navegação"))
    expect(document.body.style.overflow).toBe("")

    await userEvent.click(screen.getByText("Menu"))
    fireEvent.click(container.querySelector('[aria-hidden="true"].fixed'))
    expect(document.body.style.overflow).toBe("")
  })

  it("disables images and animations in survival mode", async () => {
    Object.assign(survival, { disableImages: true, disableAnimations: true })
    const { container } = renderShell()
    expect(container.querySelector(".survival-no-animations")).not.toBeNull()
    expect(container.querySelector(".bg-atlas")).toBeNull()
    await userEvent.click(screen.getByText("Menu"))
    expect(container.querySelector(".backdrop-blur-xs")).toBeNull()
  })
})

describe("LanguageSelector", () => {
  afterEach(async () => {
    await i18n.changeLanguage("cimode")
  })

  it("opens, closes on outside click and changes language", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {})
    const onLanguageChange = vi.fn()
    render(
      <div>
        <span>outside</span>
        <LanguageSelector onLanguageChange={onLanguageChange} />
      </div>,
    )
    const button = screen.getByTitle(/languageLabel/)
    await userEvent.click(button)
    expect(screen.getByText("selectLanguage")).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByText("selectLanguage"))
    expect(screen.getByText("selectLanguage")).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByText("outside"))
    expect(screen.queryByText("selectLanguage")).toBeNull()

    await userEvent.click(button)
    await userEvent.click(screen.getByText("(fr)"))
    await waitFor(() => expect(onLanguageChange).toHaveBeenCalledWith("fr"))
    expect(localStorage.getItem("preferredLanguage")).toBe("fr")
    expect(screen.getByTitle(/Français/)).toBeInTheDocument()

    await userEvent.click(screen.getByTitle(/Français/))
    expect(screen.getByText("✓")).toBeInTheDocument()
    await userEvent.click(screen.getByText("(fr)"))
    expect(screen.queryByText("selectLanguage")).toBeNull()
  })

  it("works without a callback and reports failures", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const original = i18n.changeLanguage.bind(i18n)
    vi.spyOn(i18n, "changeLanguage").mockImplementation((lng) =>
      lng === "es" ? Promise.reject(new Error("nope")) : original(lng),
    )
    render(<LanguageSelector />)
    await userEvent.click(screen.getByTitle(/languageLabel/))
    await userEvent.click(screen.getByText("(pt)"))
    await waitFor(() => expect(localStorage.getItem("preferredLanguage")).toBe("pt"))

    await userEvent.click(screen.getByTitle(/Português/))
    await userEvent.click(screen.getByText("(es)"))
    await waitFor(() => expect(error).toHaveBeenCalled())
    expect(localStorage.getItem("preferredLanguage")).toBe("pt")
  })
})

describe("ProfileCard", () => {
  it.each([
    ["ADMIN", "roleadmin"],
    ["TEACHER", "roleprofessor"],
    ["OTHER", "OTHER"],
  ])("labels the %s role", (role, label) => {
    render(<ProfileCard user={{ role, name: "N", email: "e@x" }} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it("shows student info, photo and actions", async () => {
    const onEdit = vi.fn()
    const onSettings = vi.fn()
    const { container, rerender } = render(
      <ProfileCard
        user={{ role: "STUDENT", name: "S", email: "s@x", profilePhoto: "/p.jpg", createdAt: "2026-01-01" }}
        onEditClick={onEdit}
        onSettingsClick={onSettings}
        onPhotoUpload={vi.fn()}
      />,
    )
    expect(screen.getByAltText("S")).toHaveAttribute("src", "http://localhost:3000/p.jpg")
    expect(screen.getByText("rolestudent")).toBeInTheDocument()
    await userEvent.click(screen.getByTitle("editProfile"))
    await userEvent.click(screen.getByTitle("settings"))
    expect(onEdit).toHaveBeenCalled()
    expect(onSettings).toHaveBeenCalled()
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {})
    await userEvent.click(screen.getByTitle("uploadPhoto"))
    expect(click).toHaveBeenCalled()

    rerender(<ProfileCard user={{ role: "STUDENT" }} loading />)
    expect(container.querySelectorAll(".skeleton")).toHaveLength(2)
    rerender(<ProfileCard user={null} />)
    expect(screen.getAllByText("-").length).toBeGreaterThan(0)
  })

  it("previews and uploads a new photo", async () => {
    let finishUpload
    const onPhotoUpload = vi.fn(() => new Promise((r) => (finishUpload = r)))
    const { container } = render(<ProfileCard user={{ role: "TEACHER", name: "T" }} onPhotoUpload={onPhotoUpload} />)
    const input = container.querySelector('input[type="file"]')
    const file = new File(["img"], "a.png", { type: "image/png" })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByAltText("T").getAttribute("src")).toMatch(/^data:/))
    await act(async () => finishUpload())
    expect(onPhotoUpload).toHaveBeenCalledWith(file)
    fireEvent.change(input, { target: { files: [] } })
    expect(onPhotoUpload).toHaveBeenCalledTimes(1)
  })
})

describe("DataTablePaginated", () => {
  const columns = [{ key: "name", label: "Name" }]
  const rows = Array.from({ length: 12 }, (_, i) => ({ id: i, name: `row-${i}` }))

  it("shows empty and loading states", () => {
    const { rerender, container } = render(<DataTablePaginated columns={columns} rows={[]} />)
    expect(screen.getByText("noData")).toBeInTheDocument()
    rerender(<DataTablePaginated columns={columns} rows={[]} emptyMessage="Nada" />)
    expect(screen.getByText("Nada")).toBeInTheDocument()
    rerender(<DataTablePaginated columns={columns} rows={rows} loading />)
    expect(container.querySelector(".skeleton-table-row")).not.toBeNull()
  })

  it("paginates and handles row clicks", async () => {
    const onRowClick = vi.fn()
    const { rerender } = render(
      <DataTablePaginated columns={columns} rows={rows} pageSize={5} totalCount={99} onRowClick={onRowClick} />,
    )
    expect(screen.getByText("Exibindo 1 a 5 de 99 registros")).toBeInTheDocument()
    await userEvent.click(screen.getByText("row-0"))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
    await userEvent.click(screen.getByText("continue"))
    await userEvent.click(screen.getByText("continue"))
    expect(screen.getByText("row-10")).toBeInTheDocument()
    await userEvent.click(screen.getByText("previous"))
    expect(screen.getByText("row-5")).toBeInTheDocument()
    await userEvent.click(screen.getByText("continue"))

    rerender(<DataTablePaginated columns={columns} rows={rows.slice(0, 3).map(({ name }) => ({ name }))} pageSize={5} />)
    expect(await screen.findByText("row-0")).toBeInTheDocument()
    await userEvent.click(screen.getByText("row-0"))
    expect(screen.queryByText(/Exibindo/)).toBeNull()
    render(<DataTablePaginated />)
  })
})

describe("SettingsForm", () => {
  it("edits numeric settings and submits", () => {
    let form = { passAverage: 10, maxAbsencesPerCourse: 5, assignmentLateDaysLimit: 2, gradeReviewWindowDays: 7 }
    const setSettingsForm = vi.fn((fn) => {
      form = fn(form)
    })
    const saveSettings = vi.fn((e) => e.preventDefault())
    const { container } = render(
      <SettingsForm t={(k) => k} settingsForm={form} setSettingsForm={setSettingsForm} saveSettings={saveSettings} loading={false} />,
    )
    const inputs = container.querySelectorAll('input[type="number"]')
    fireEvent.change(inputs[0], { target: { value: "12" } })
    fireEvent.change(inputs[1], { target: { value: "3" } })
    fireEvent.change(inputs[2], { target: { value: "1" } })
    fireEvent.change(inputs[3], { target: { value: "9" } })
    expect(form).toEqual({ passAverage: 12, maxAbsencesPerCourse: 3, assignmentLateDaysLimit: 1, gradeReviewWindowDays: 9 })
    fireEvent.submit(container.querySelector("form"))
    expect(saveSettings).toHaveBeenCalled()
  })
})
