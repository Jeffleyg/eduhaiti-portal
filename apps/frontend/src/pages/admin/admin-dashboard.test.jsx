import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { renderWithRouter } from "../../test/utils.jsx"

const auth = { token: "tok", user: { name: "Marie Joseph" } }
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => auth }))
const survival = { disableBackgroundSync: false }
vi.mock("../../context/useSurvivalMode.js", () => ({ useSurvivalMode: () => survival }))
vi.mock("../../context/useSyncControl.js", () => ({ useSyncControl: () => ({ syncRevision: 0 }) }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../../lib/api.js"
import { writeHomeCache } from "../../offline/sqliteCache.js"
import AdminDashboard from "./AdminDashboard.jsx"

const week = (day, rate, records = 4) => ({ weekStart: `2026-11-${String(day).padStart(2, "0")}T00:00:00.000Z`, rate, records })

const full = () => ({
  generatedAt: "2026-11-21T12:00:00.000Z",
  school: { name: "Lycée Pétion" },
  academicYear: "2025-2026",
  currentPeriod: { name: "1er Trimestre", startDate: "2026-09-01T00:00:00.000Z", endDate: "2026-12-15T00:00:00.000Z" },
  nextPeriod: null,
  headcount: { students: 120, teachers: 9, classes: 4, disciplines: 11, enrolled: 110, capacity: 120 },
  attendance: { rate: 0.92, previousRate: 0.88, records: 640, weekly: [week(2, null, 0), week(9, 0.9), week(16, 0.95)] },
  grades: {
    average: 11.4,
    count: 300,
    passRate: 0.7,
    gradedStudents: 100,
    classes: [
      { id: "c2", name: "NS1", level: "Secondaire", students: 25, capacity: 30, hasTeacher: false, average: null },
      { id: "c1", name: "9e A", level: "Fondamental", students: 30, capacity: 30, hasTeacher: true, average: 13.25 },
      { id: "c3", name: "9e B", level: "Fondamental", students: 28, capacity: 30, hasTeacher: true, average: 9.5 },
    ],
  },
  finance: { collectedThisMonth: 150000, collectedPreviousMonth: 90000, outstandingAmount: 42000, outstandingCount: 7, overdueCount: 3 },
  risk: {
    count: 6,
    students: [
      { id: "s1", name: "Jean Pierre", enrollmentNumber: "E-1", absenceRate: 0.4, average: 9, gradeDelta: -3.5, chronicAbsence: true, suddenGradeDrop: true },
      { id: "s2", name: "Anne Louis", enrollmentNumber: null, absenceRate: 0.1, average: 8, gradeDelta: -4, chronicAbsence: false, suddenGradeDrop: true },
      { id: "s3", name: "Paul", enrollmentNumber: "E-3", absenceRate: 0.5, average: 12, gradeDelta: 0, chronicAbsence: true, suddenGradeDrop: false },
    ],
  },
  actions: { pendingRequests: 2, pendingActivation: 1, draftGrades: 5, studentsWithoutClass: 3, classesWithoutTeacher: 1, noOpenPeriod: true },
})

const empty = () => ({
  ...full(),
  school: { name: null },
  academicYear: null,
  currentPeriod: null,
  headcount: { students: 0, teachers: 0, classes: 0, disciplines: 0, enrolled: 0, capacity: 0 },
  attendance: { rate: null, previousRate: null, records: 0, weekly: [week(9, null, 0), week(16, null, 0)] },
  grades: { average: null, count: 0, passRate: null, gradedStudents: 0, classes: [] },
  finance: null,
  risk: { count: 0, students: [] },
  actions: { pendingRequests: 0, pendingActivation: 0, draftGrades: 0, studentsWithoutClass: 0, classesWithoutTeacher: 0, noOpenPeriod: false },
})

beforeEach(() => {
  apiFetch.mockReset()
  auth.token = "tok"
  survival.disableBackgroundSync = false
})

describe("AdminDashboard", () => {
  it("shows a skeleton, then every section of a busy school, and caches it", async () => {
    apiFetch.mockResolvedValue(full())
    const { container } = renderWithRouter(<AdminDashboard />)
    expect(container.querySelector("[aria-busy=true]")).toBeInTheDocument()

    expect(await screen.findByText("dashboardGreeting")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/dashboard", { token: "tok" })
    expect(screen.getByText("Lycée Pétion")).toBeInTheDocument()
    expect(screen.getByText("2025-2026")).toBeInTheDocument()
    expect(screen.getByText("dashboardPeriodUntil")).toBeInTheDocument()

    // KPIs
    expect(screen.getByText("120")).toBeInTheDocument()
    expect(screen.getByText("dashboardFill")).toBeInTheDocument()
    expect(screen.getByText("92%")).toBeInTheDocument()
    expect(screen.getByText("dashboardPointsDelta")).toHaveClass("text-emerald-700")
    expect(screen.getByText("11,4/20")).toBeInTheDocument()
    expect(screen.getByText("dashboardPassRate")).toBeInTheDocument()

    // Chart has an accessible table with one row per week
    const table = screen.getByRole("table", { name: "dashboardAttendanceTrend" })
    expect(within(table).getAllByRole("row")).toHaveLength(3)
    expect(within(table).getByText("95%")).toBeInTheDocument()

    // Actions link to the right pages; draft grades are informational
    expect(screen.getByRole("link", { name: "dashboardActionNoPeriod" })).toHaveAttribute("href", "/admin/academic")
    expect(screen.getByRole("link", { name: "dashboardActionRequests" })).toHaveAttribute("href", "/admin/academic-requests")
    expect(screen.getByRole("link", { name: "dashboardActionNoClass" })).toHaveAttribute("href", "/admin/students")
    expect(screen.getByRole("link", { name: "dashboardActionNoTeacher" })).toHaveAttribute("href", "/admin/classes")
    expect(screen.getByRole("link", { name: "dashboardActionActivation" })).toHaveAttribute("href", "/admin/users")
    expect(screen.queryByRole("link", { name: "dashboardActionDraftGrades" })).toBeNull()
    expect(screen.getByText("dashboardActionDraftGrades")).toBeInTheDocument()

    // Classes ranked by average, missing averages last
    const rows = screen.getAllByText(/^(9e A|9e B|NS1)$/).map((node) => node.textContent)
    expect(rows).toEqual(["9e A", "9e B", "NS1"])
    expect(screen.getByText("13,3/20")).toBeInTheDocument()
    expect(screen.getByText("Secondaire · dashboardNoTeacher")).toBeInTheDocument()

    // Risk list with both reasons and the overflow line
    expect(screen.getByText("Jean Pierre")).toBeInTheDocument()
    expect(screen.getAllByText("dashboardRiskAbsence")).toHaveLength(2)
    expect(screen.getAllByText("dashboardRiskGradeDrop")).toHaveLength(2)
    expect(screen.getByText("–")).toBeInTheDocument()
    expect(screen.getByText("dashboardRiskMore")).toBeInTheDocument()

    // Finance
    expect(screen.getByText("dashboardFinance")).toBeInTheDocument()
    expect(screen.getByLabelText("dashboardOverdue")).toBeInTheDocument()

    const stored = JSON.parse(localStorage.getItem("eduhaiti_sqlite_home_cache_v1"))
    expect(stored.adminDashboard.data.school.name).toBe("Lycée Pétion")
  })

  it("renders the empty states of a brand new school", async () => {
    apiFetch.mockResolvedValue(empty())
    renderWithRouter(<AdminDashboard />)
    expect(await screen.findByText("dashboardNoPeriod")).toBeInTheDocument()
    expect(screen.getByText("EduHaiti")).toBeInTheDocument()
    expect(screen.getByText("dashboardInClasses")).toBeInTheDocument()
    expect(screen.getAllByText("–")).toHaveLength(2)
    expect(screen.queryByText("dashboardPointsDelta")).toBeNull()
    expect(screen.getAllByText("dashboardNoGrades").length).toBeGreaterThan(0)
    expect(screen.getByText("dashboardNoAttendance")).toBeInTheDocument()
    expect(screen.getByText("dashboardNoClasses")).toBeInTheDocument()
    expect(screen.getByText("dashboardAllClear")).toBeInTheDocument()
    expect(screen.getByText("dashboardNoRisk")).toBeInTheDocument()
    expect(screen.queryByText("dashboardFinance")).toBeNull()
  })

  it("shows a falling or stable attendance trend", async () => {
    const data = full()
    data.attendance = { ...data.attendance, rate: 0.8, previousRate: 0.9 }
    data.finance.overdueCount = 0
    data.risk = { count: 1, students: [data.risk.students[1]] }
    apiFetch.mockResolvedValueOnce(data)
    const { unmount } = renderWithRouter(<AdminDashboard />)
    expect(await screen.findByText("dashboardPointsDelta")).toHaveClass("text-brand-red")
    expect(screen.queryByLabelText("dashboardOverdue")).toBeNull()
    expect(screen.queryByText("dashboardRiskMore")).toBeNull()
    unmount()

    const stable = full()
    stable.attendance = { ...stable.attendance, rate: 0.9, previousRate: 0.9 }
    apiFetch.mockResolvedValueOnce(stable)
    renderWithRouter(<AdminDashboard />)
    expect(await screen.findByText("dashboardStable")).toBeInTheDocument()
  })

  it("keeps showing cached data when a refresh fails", async () => {
    writeHomeCache("adminDashboard", full())
    apiFetch.mockRejectedValue(new Error("offline"))
    renderWithRouter(<AdminDashboard />)
    expect(screen.getByText("Lycée Pétion")).toBeInTheDocument()
    expect(await screen.findByRole("alert")).toHaveTextContent("dashboardLoadError dashboardShowingCached")
  })

  it("offers a retry when nothing could be loaded", async () => {
    apiFetch.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(full())
    renderWithRouter(<AdminDashboard />)
    expect(await screen.findByRole("alert")).toHaveTextContent("dashboardLoadError")
    fireEvent.click(screen.getByRole("button", { name: "retry" }))
    expect(await screen.findByText("Lycée Pétion")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledTimes(2)
  })

  it("does not call the API in survival mode or without a session", async () => {
    survival.disableBackgroundSync = true
    const { unmount } = renderWithRouter(<AdminDashboard />)
    expect(await screen.findByRole("alert")).toHaveTextContent("dashboardOffline")
    unmount()

    survival.disableBackgroundSync = false
    auth.token = null
    writeHomeCache("adminDashboard", full())
    renderWithRouter(<AdminDashboard />)
    await waitFor(() => expect(screen.getByText("Lycée Pétion")).toBeInTheDocument())
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it("ignores a cache entry with another shape (regression: blank /admin)", async () => {
    // What the generic sync wrote for admins before the dashboard existed.
    writeHomeCache("admin", { classes: [] })
    writeHomeCache("adminDashboard", { classes: [] })
    apiFetch.mockResolvedValue(full())
    renderWithRouter(<AdminDashboard />)
    expect(await screen.findByText("Lycée Pétion")).toBeInTheDocument()
  })

  it("treats an unexpected server payload as a load error", async () => {
    apiFetch.mockResolvedValue({ message: "nope" })
    renderWithRouter(<AdminDashboard />)
    expect(await screen.findByRole("alert")).toHaveTextContent("dashboardLoadError")
  })
})
