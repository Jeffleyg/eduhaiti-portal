import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../../test/utils.jsx"

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: "tok" }) }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../../lib/api.js"
import ProfessorAttendance from "./ProfessorAttendance.jsx"

const QUEUE = "eduhaiti_offline_attendance_queue"
const classes = [
  { id: "c1", name: "3e", level: "A", students: [{ id: "s1", name: "Ana" }, { id: "s2", name: "Bob" }] },
  { id: "c2", name: "4e" },
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
    if (path.startsWith("/attendance/class/c1")) return [{ studentId: "s2", status: "ABSENT" }]
    if (path.startsWith("/attendance/class/c2"))
      return { data: [{ id: "x", student: { firstName: "Cid", lastName: "Doe", enrollmentNumber: "E9" } }, { id: "y", name: "Raw" }, { studentId: "z" }] }
    return {}
  })

beforeEach(() => {
  apiFetch.mockReset()
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

const row = (name) => screen.getByText(name).closest("div.p-4")

describe("ProfessorAttendance", () => {
  it("builds the roll call from the class roster with recorded statuses", async () => {
    routes()
    renderWithRouter(<ProfessorAttendance />)
    expect(await screen.findByText("Ana")).toBeInTheDocument()
    expect(within(row("Ana")).getByText("attendancePresent")).toHaveClass("bg-emerald-600")
    expect(within(row("Bob")).getByText("attendanceAbsent")).toHaveClass("bg-rose-600")
    await userEvent.click(within(row("Ana")).getByText("attendanceLate"))
    expect(within(row("Ana")).getByText("attendanceLate")).toHaveClass("bg-amber-500")
    await userEvent.click(within(row("Ana")).getByText("attendanceExcused"))
    expect(within(row("Ana")).getByText("attendanceExcused")).toHaveClass("bg-sky-600")
  })

  it("falls back to recorded rows when the class has no roster", async () => {
    routes()
    renderWithRouter(<ProfessorAttendance />)
    await screen.findByText("Ana")
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "c2" } })
    expect(await screen.findByText("Cid Doe")).toBeInTheDocument()
    expect(screen.getByText("E9")).toBeInTheDocument()
    expect(screen.getByText("Raw")).toBeInTheDocument()
    expect(screen.getByText("studentNumber")).toBeInTheDocument()
    expect(screen.getAllByText("enrollmentNotAvailable")).toHaveLength(2)
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: "2026-01-05" } })
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/attendance/class/c2?date=2026-01-05", { token: "tok" }))
  })

  it("posts one record per student to the admin endpoint", async () => {
    routes({ "POST /admin/attendance": {} })
    renderWithRouter(<ProfessorAttendance />)
    await screen.findByText("Ana")
    await userEvent.click(screen.getByText("submitAttendance"))
    expect(await screen.findByText("attendanceSaved")).toBeInTheDocument()
    const posts = apiFetch.mock.calls.filter((c) => c[1]?.method === "POST").map((c) => c[1].body)
    expect(posts).toEqual([
      { studentId: "s1", classId: "c1", date: expect.any(String), status: "PRESENT" },
      { studentId: "s2", classId: "c1", date: expect.any(String), status: "ABSENT" },
    ])
  })

  it("queues failed records offline and syncs them later", async () => {
    let online = false
    routes({ "POST /admin/attendance": () => (online ? {} : Promise.reject(new Error("offline"))) })
    renderWithRouter(<ProfessorAttendance />)
    await screen.findByText("Ana")
    await userEvent.click(screen.getByText("submitAttendance"))
    expect(await screen.findByText("attendanceOfflineSaved")).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(QUEUE))).toHaveLength(2)
    expect(screen.getByText("2")).toBeInTheDocument()

    // a legacy bulk entry is expanded into per-student records
    const queue = JSON.parse(localStorage.getItem(QUEUE))
    queue.push({ classId: "c1", date: "2026-01-01", records: [{ studentId: "s9", status: "LATE" }] })
    localStorage.setItem(QUEUE, JSON.stringify(queue))

    online = true
    await userEvent.click(screen.getByText("syncNow"))
    expect(await screen.findByText("syncComplete")).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(QUEUE))).toEqual([])
    const synced = apiFetch.mock.calls.filter((c) => c[1]?.method === "POST").slice(-3).map((c) => c[1].body)
    expect(synced[2]).toEqual({ studentId: "s9", classId: "c1", date: "2026-01-01", status: "LATE" })
    expect(synced[0]).not.toHaveProperty("offlineId")
  })

  it("keeps failed items in the queue during sync", async () => {
    localStorage.setItem(QUEUE, JSON.stringify([{ studentId: "s1", classId: "c1", date: "d", status: "PRESENT" }]))
    routes({ "POST /admin/attendance": new Error("still offline") })
    renderWithRouter(<ProfessorAttendance />)
    await screen.findByText("Ana")
    await userEvent.click(screen.getByText("syncNow"))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(QUEUE))).toHaveLength(1))
    expect(screen.queryByText("syncComplete")).toBeNull()
  })

  it("reports storage errors", async () => {
    routes({ "POST /admin/attendance": new Error("offline") })
    renderWithRouter(<ProfessorAttendance />)
    await screen.findByText("Ana")
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full")
    })
    await userEvent.click(screen.getByText("submitAttendance"))
    expect(await screen.findByText("offlineError")).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText("closeMessage"))
    expect(screen.queryByText("offlineError")).toBeNull()
  })

  it("survives a corrupted queue and sync errors", async () => {
    localStorage.setItem(QUEUE, "{bad")
    routes()
    const { unmount } = renderWithRouter(<ProfessorAttendance />)
    await screen.findByText("Ana")
    expect(screen.queryByText("syncNow")).toBeNull()
    unmount()

    localStorage.setItem(QUEUE, JSON.stringify([{ studentId: "s1" }]))
    renderWithRouter(<ProfessorAttendance />)
    await screen.findByText("Ana")
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("blocked")
    })
    await userEvent.click(screen.getByText("syncNow"))
    await waitFor(() => expect(console.error).toHaveBeenCalledWith("Erro na sincronização:", expect.any(Error)))
  })

  it("ignores a sync with an empty queue", async () => {
    localStorage.setItem(QUEUE, JSON.stringify([{ studentId: "s1" }]))
    routes()
    renderWithRouter(<ProfessorAttendance />)
    await screen.findByText("Ana")
    localStorage.setItem(QUEUE, "[]")
    await userEvent.click(screen.getByText("syncNow"))
    expect(apiFetch.mock.calls.some((c) => c[1]?.method === "POST")).toBe(false)
  })

  it("handles load errors and teachers without classes", async () => {
    apiFetch.mockRejectedValueOnce(new Error("down"))
    const { unmount } = renderWithRouter(<ProfessorAttendance />)
    expect(await screen.findByText("common.errorLoading")).toBeInTheDocument()
    unmount()

    apiFetch.mockResolvedValueOnce({ data: [] })
    renderWithRouter(<ProfessorAttendance />)
    expect(await screen.findByText("noStudentsInClass")).toBeInTheDocument()
  })

  it("logs attendance load errors and accepts null payloads", async () => {
    routes({ "GET /attendance/class/c1": new Error("att down") })
    const { unmount } = renderWithRouter(<ProfessorAttendance />)
    await waitFor(() => expect(console.error).toHaveBeenCalledWith("Erro ao carregar presença:", expect.any(Error)))
    unmount()
    routes({ "GET /classes/my-classes": null })
    renderWithRouter(<ProfessorAttendance />)
    expect(await screen.findByText("noStudentsInClass")).toBeInTheDocument()
  })

  it("shows the saving label", async () => {
    routes({ "POST /admin/attendance": () => new Promise(() => {}) })
    renderWithRouter(<ProfessorAttendance />)
    await screen.findByText("Ana")
    await userEvent.click(screen.getByText("submitAttendance"))
    expect(screen.getByText("saving")).toBeInTheDocument()
  })
})
