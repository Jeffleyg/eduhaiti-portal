import { beforeEach, describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { renderWithRouter } from "../test/utils.jsx"

const auth = { token: "tok", user: { enrollmentNumber: "E1" } }
vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => auth }))
const survival = { disableBackgroundSync: false }
vi.mock("../context/useSurvivalMode.js", () => ({ useSurvivalMode: () => survival }))
vi.mock("../context/useSyncControl.js", () => ({ useSyncControl: () => ({ syncRevision: 0 }) }))
vi.mock("../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../lib/api.js"
import { writeHomeCache } from "../offline/sqliteCache.js"
import ProfessorDashboard from "./professor/ProfessorDashboard.jsx"
import StudentDashboard from "./student/StudentDashboard.jsx"

beforeEach(() => {
  apiFetch.mockReset()
  auth.token = "tok"
  auth.user = { enrollmentNumber: "E1" }
  survival.disableBackgroundSync = false
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("ProfessorDashboard", () => {
  it("loads classes, messages and the leaderboard and caches them", async () => {
    apiFetch.mockImplementation(async (path) => {
      if (path === "/classes/my-classes") return [{ id: "c1", name: "3e", students: [{}, {}] }, { id: "c2", name: "4e" }]
      if (path === "/classes/my-summary") return { attendanceRate: 88, publishedGrades: 5, draftGrades: 1, upcomingAssignments: 2 }
      if (path === "/messages/inbox")
        return [
          { id: "m1", subject: "Hi", from: { name: "Adm", role: "ADMIN" } },
          { id: "m2", subject: "Yo", from: { email: "x@y" } },
          { id: "m3", subject: "3" },
          { id: "m4", subject: "fourth-message" },
        ]
      if (path === "/gamification/class/c1/leaderboard")
        return { leaderboard: [{ student: { id: "s1", name: "Ana" }, points: 120, attendanceRate: 90, earlySubmissions: 2 }, {}] }
      return null
    })
    renderWithRouter(<ProfessorDashboard />)
    expect(await screen.findByText("1. Ana")).toBeInTheDocument()
    expect(screen.getByText("120 pts")).toBeInTheDocument()
    expect(screen.getByText("0 pts")).toBeInTheDocument()
    expect(screen.getByText("2 students")).toBeInTheDocument()
    expect(screen.getByText("0 students")).toBeInTheDocument()
    expect(screen.queryByText("fourth-message")).toBeNull()
    expect(JSON.parse(localStorage.getItem("eduhaiti_sqlite_home_cache_v1")).professor.data.stats).toEqual({
      attendance: "88%",
      grades: 5,
      messages: 4,
      tasks: 2,
    })
    expect(screen.getByText("88%")).toBeInTheDocument()
  })

  it("handles empty responses and errors", async () => {
    apiFetch.mockResolvedValue(null)
    const { unmount } = renderWithRouter(<ProfessorDashboard />)
    expect(await screen.findByText("gamificationEmpty")).toBeInTheDocument()
    expect(screen.getAllByText("noData")).toHaveLength(2)
    unmount()

    // classes, inbox, summary (no data yet), then the leaderboard
    apiFetch
      .mockResolvedValueOnce([{ id: "c1" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ attendanceRate: null })
      .mockResolvedValueOnce(null)
    const second = renderWithRouter(<ProfessorDashboard />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/gamification/class/c1/leaderboard", { token: "tok" }))
    // Nothing measured yet: show "-" instead of an invented percentage.
    expect(await screen.findByText("-")).toBeInTheDocument()
    second.unmount()

    apiFetch.mockRejectedValue(new Error("down"))
    renderWithRouter(<ProfessorDashboard />)
    await waitFor(() => expect(console.error).toHaveBeenCalled())
  })

  it("uses the cache and skips loading in survival mode or without token", async () => {
    writeHomeCache("professor", { classes: [{ id: "c", name: "Cached" }], stats: {}, recentMessages: [], leaderboard: [] })
    survival.disableBackgroundSync = true
    const { unmount } = renderWithRouter(<ProfessorDashboard />)
    expect(screen.getByText("Cached")).toBeInTheDocument()
    expect(screen.getAllByText("0")).toHaveLength(4)
    unmount()
    localStorage.clear()
    survival.disableBackgroundSync = false
    auth.token = null
    renderWithRouter(<ProfessorDashboard />)
    expect(await screen.findAllByText("noData")).toHaveLength(2)
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it("shows the loader while fetching without cache", () => {
    apiFetch.mockImplementation(() => new Promise(() => {}))
    renderWithRouter(<ProfessorDashboard />)
    expect(screen.getByText("loading")).toBeInTheDocument()
  })
})

describe("StudentDashboard", () => {
  const routes = () =>
    apiFetch.mockImplementation(async (path) => {
      if (path === "/classes/my-classes") return [{ id: "c1", name: "3e", teacher: { name: "T" } }, { id: "c2", name: "4e", teacher: { email: "t@x" } }]
      if (path === "/grades/my-grades") return [{ score: 15, maxScore: 20 }, { score: 5, maxScore: 10 }]
      if (path === "/attendance/my-attendance") return [{ status: "PRESENT" }, { status: "ABSENT" }, { status: "present" }, { status: "LATE" }]
      if (path === "/messages/inbox") return [{ id: "m1", subject: "Notice", from: { name: "Adm", role: "ADMIN" } }, { id: "m2", subject: "Raw", from: { email: "r@x" } }]
      if (path === "/gamification/me") return { points: 80, earlySubmissions: 3, perfectAttendanceClasses: 1, badges: [{ code: "B", name: "Badge!" }] }
      return null
    })

  it("computes grades and attendance rates (case-insensitive) and shows badges", async () => {
    routes()
    renderWithRouter(<StudentDashboard />)
    expect(await screen.findByText("12.5")).toBeInTheDocument()
    expect(screen.getByText("50%")).toBeInTheDocument()
    expect(screen.getByText("Badge!")).toBeInTheDocument()
    expect(screen.getByText("80")).toBeInTheDocument()
    expect(screen.getByText("E1")).toBeInTheDocument()
    expect(screen.getByText("T")).toBeInTheDocument()
    expect(screen.getByText("t@x")).toBeInTheDocument()
    expect(screen.getByText("Notice")).toBeInTheDocument()
  })

  it("uses defaults for empty data", async () => {
    auth.user = null
    apiFetch.mockResolvedValue(null)
    renderWithRouter(<StudentDashboard />)
    expect(await screen.findByText("badgesHint")).toBeInTheDocument()
    expect(screen.getByText("0%")).toBeInTheDocument()
    expect(screen.getByText("-")).toBeInTheDocument()
    expect(screen.getAllByText("noData")).toHaveLength(2)
  })

  it("shows errors with and without a message", async () => {
    apiFetch.mockRejectedValue(new Error("boom"))
    const { unmount } = renderWithRouter(<StudentDashboard />)
    expect(await screen.findByText("boom")).toBeInTheDocument()
    unmount()
    apiFetch.mockRejectedValue(new Error(""))
    renderWithRouter(<StudentDashboard />)
    expect(await screen.findByText("common.errorLoading")).toBeInTheDocument()
  })

  it("uses the cache in survival mode and shows the loader otherwise", () => {
    writeHomeCache("student", { classes: [], recentMessages: [], stats: {}, gamification: null })
    survival.disableBackgroundSync = true
    const { unmount } = renderWithRouter(<StudentDashboard />)
    expect(screen.getByText("badgesHint")).toBeInTheDocument()
    unmount()
    localStorage.clear()
    survival.disableBackgroundSync = false
    apiFetch.mockImplementation(() => new Promise(() => {}))
    const { container } = renderWithRouter(<StudentDashboard />)
    expect(container.querySelector(".skeleton-card")).not.toBeNull()
  })
})
