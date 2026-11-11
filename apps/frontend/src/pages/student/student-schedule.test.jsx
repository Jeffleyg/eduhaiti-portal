import { beforeEach, describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithRouter } from "../../test/utils.jsx"

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: "tok" }) }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../../lib/api.js"
import StudentSchedule from "./StudentSchedule.jsx"

describe("StudentSchedule", () => {
  beforeEach(() => {
    apiFetch.mockReset()
  })

  it("shows today's attendance per class and the month history", async () => {
    const today = new Date().toISOString().slice(0, 10)
    apiFetch.mockImplementation(async (path) => {
      if (path === "/classes/my-classes") {
        return [
          { id: "c1", name: "Math 3e", teacher: { name: "Prof", email: "p@x" } },
          { id: "c2", name: "Bio 3e", teacher: { email: "b@x" } },
        ]
      }
      return [
        { classId: "c1", date: `${today}T08:00:00Z`, status: "PRESENT", class: { name: "Math 3e" } },
        { classId: "c2", date: "2026-01-02T08:00:00Z", status: "ABSENT", class: null },
      ]
    })
    renderWithRouter(<StudentSchedule />)
    expect(await screen.findByText("todayAttendance")).toBeInTheDocument()
    expect(screen.getAllByText("PRESENT")).toHaveLength(2)
    expect(screen.getByText("SEM_MARCACAO")).toBeInTheDocument()
    expect(screen.getByText("ABSENT")).toBeInTheDocument()
    expect(screen.getAllByText("-")).toHaveLength(2)
    expect(screen.getByText("Prof")).toBeInTheDocument()
    expect(apiFetch.mock.calls[1][0]).toMatch(/^\/attendance\/my-attendance\?startDate=\d{4}-\d{2}-01&endDate=/)
  })

  it("handles empty data", async () => {
    apiFetch.mockResolvedValue(null)
    renderWithRouter(<StudentSchedule />)
    expect(await screen.findByText("allClasses")).toBeInTheDocument()
    expect(screen.getAllByText("noData")).toHaveLength(3)
  })

  it("logs loading failures", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    apiFetch.mockRejectedValue(new Error("down"))
    renderWithRouter(<StudentSchedule />)
    expect(await screen.findByText("navSchedule")).toBeInTheDocument()
    expect(error).toHaveBeenCalled()
  })

  it("shows a loader first", () => {
    apiFetch.mockImplementation(() => new Promise(() => {}))
    renderWithRouter(<StudentSchedule />)
    expect(screen.getByText("loading")).toBeInTheDocument()
  })
})
