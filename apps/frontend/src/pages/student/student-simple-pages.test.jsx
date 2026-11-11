import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter, routeApi } from "../../test/utils.jsx"

const auth = { token: "tok", user: { role: "STUDENT" }, refreshProfile: vi.fn() }
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => auth }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn(), apiUpload: vi.fn() }))

import { apiFetch, apiUpload } from "../../lib/api.js"
import StudentLessonPlans from "./StudentLessonPlans.jsx"
import StudentAssignments from "./StudentAssignments.jsx"

beforeEach(() => {
  apiFetch.mockReset()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("StudentLessonPlans", () => {
  it("loads lesson plans for every class, newest first", async () => {
    apiFetch.mockImplementation(
      routeApi({
        "/classes/my-classes": [{ id: "c1" }, { id: "c 2" }],
        "/lessons?classId=c1": [
          { id: "l1", title: "Older", date: "2026-01-01", content: "c1", discipline: { name: "Math" } },
        ],
        "/lessons?classId=c%202": {
          data: [{ id: "l2", title: "Newer", date: "2026-02-01", objectives: "obj", subject: "Bio" }],
        },
      }),
    )
    renderWithRouter(<StudentLessonPlans />)
    expect(await screen.findByText("Newer")).toBeInTheDocument()
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(["Newer", "Older"])
    expect(screen.getByText("Math")).toBeInTheDocument()
    expect(screen.getByText("Bio")).toBeInTheDocument()
    expect(screen.getByText("obj")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/classes/my-classes", { token: "tok" })
  })

  it("handles odd payloads and missing fields", async () => {
    apiFetch.mockImplementation(
      routeApi({
        "/classes/my-classes": [{ id: "a" }, { id: "b" }],
        "/lessons?classId=a": { other: true },
        "/lessons?classId=b": [{ id: "x", title: "NoDate" }, { id: "y", title: "AlsoNoDate", date: "2026-01-01" }],
      }),
    )
    renderWithRouter(<StudentLessonPlans />)
    expect(await screen.findByText("NoDate")).toBeInTheDocument()
    expect(screen.getAllByText("common.discipline")).toHaveLength(2)
  })

  it("shows the empty state and refreshes", async () => {
    apiFetch.mockImplementation(routeApi({ "/classes/my-classes": { not: "array" } }))
    renderWithRouter(<StudentLessonPlans />)
    expect(await screen.findByText("lessons.emptyTitle")).toBeInTheDocument()
    await userEvent.click(screen.getByText("common.refresh"))
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2))
  })

  it("shows an error when loading fails", async () => {
    apiFetch.mockRejectedValue(new Error("down"))
    renderWithRouter(<StudentLessonPlans />)
    expect(await screen.findByText("common.errorLoading")).toHaveClass("text-brand-red")
    await userEvent.click(screen.getByLabelText("closeMessage"))
    expect(screen.queryByText("common.errorLoading")).toBeNull()
  })
})

describe("StudentAssignments", () => {
  it("lists assignments with status badges and downloads", async () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    apiFetch.mockImplementation(
      routeApi({
        "/assignments/my-assignments": [
          { id: "1", title: "Open", dueDate: future, discipline: { name: "Math" }, filePath: "uploads/a.pdf" },
          { id: "2", title: "Late", dueDate: "2020-01-01", subject: "Bio", fileUrl: "http://x/f" },
          { id: "3", title: "NoDue", description: "d" },
        ],
      }),
    )
    renderWithRouter(<StudentAssignments />)
    expect(await screen.findByText("Open")).toBeInTheDocument()
    expect(screen.getByText("assignments.open")).toBeInTheDocument()
    expect(screen.getByText("assignments.expired")).toBeInTheDocument()
    expect(screen.getAllByText("assignments.noDueDate")).toHaveLength(2)
    const links = screen.getAllByText("common.downloadFile")
    expect(links[0]).toHaveAttribute("href", "http://localhost:3000/uploads/a.pdf")
    expect(links[1]).toHaveAttribute("href", "http://x/f")
    expect(screen.getByText("common.discipline")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/assignments/my-assignments", { token: "tok" })
  })

  it("hands in work, shows status, grade and feedback, and reports errors", async () => {
    apiUpload.mockReset()
    let delivered = false
    apiFetch.mockImplementation(async () => [
      {
        id: "1",
        title: "Essay",
        submissions: delivered ? [{ status: "SUBMITTED", submittedAt: "2026-01-02T10:00:00Z" }] : [],
      },
      {
        id: "2",
        title: "Graded",
        submissions: [{ status: "LATE", submittedAt: "2026-01-03T10:00:00Z", grade: 15, feedback: "Bien" }],
      },
    ])
    apiUpload.mockImplementationOnce(async () => {
      delivered = true
      return {}
    })
    renderWithRouter(<StudentAssignments />)
    expect(await screen.findByText("submissionPending")).toBeInTheDocument()
    expect(screen.getByTestId("submission-2")).toHaveTextContent(/submissionLate: .* \| gradeLabel: 15 \| Bien/)
    expect(screen.getByText("submissionResend")).toBeDisabled()

    const input = screen.getByLabelText("submissionFile Essay")
    const file = new File(["x"], "essay.pdf", { type: "application/pdf" })
    fireEvent.change(input, { target: { files: [file] } })
    await userEvent.click(screen.getByText("submissionSend"))
    expect(await screen.findByText("submissionSent")).toBeInTheDocument()
    expect(apiUpload.mock.calls[0][0]).toBe("/assignments/1/submit")
    expect(apiUpload.mock.calls[0][1].formData.get("file")).toBe(file)
    expect(screen.getByTestId("submission-1")).toHaveTextContent("submissionDone")

    const big = new File(["x"], "big.pdf")
    Object.defineProperty(big, "size", { value: 21 * 1024 * 1024 })
    fireEvent.change(screen.getByLabelText("submissionFile Graded"), { target: { files: [big] } })
    await userEvent.click(screen.getAllByText("submissionResend")[1])
    expect(await screen.findByText("submissionTooLarge")).toBeInTheDocument()
    expect(apiUpload).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByLabelText("submissionFile Graded"), { target: { files: [file] } })
    apiUpload.mockRejectedValueOnce(new Error("Student is not enrolled in this class"))
    await userEvent.click(screen.getAllByText("submissionResend")[1])
    expect(await screen.findByText("Student is not enrolled in this class")).toBeInTheDocument()

    apiUpload.mockRejectedValueOnce(new Error(""))
    await userEvent.click(screen.getAllByText("submissionResend")[1])
    expect(await screen.findByText("submissionFailed")).toBeInTheDocument()

    apiUpload.mockImplementationOnce(() => new Promise(() => {}))
    await userEvent.click(screen.getAllByText("submissionResend")[1])
    expect(await screen.findByText("loading")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("submissionFile Essay"), { target: { files: [] } })
    expect(screen.getAllByText("submissionResend")[0]).toBeDisabled()
  })

  it("accepts wrapped payloads, empty lists and errors", async () => {
    apiFetch.mockResolvedValueOnce({ data: [{ id: "1", title: "Wrapped" }] })
    const { unmount } = renderWithRouter(<StudentAssignments />)
    expect(await screen.findByText("Wrapped")).toBeInTheDocument()
    unmount()

    apiFetch.mockResolvedValueOnce({})
    const second = renderWithRouter(<StudentAssignments />)
    expect(await screen.findByText("assignments.emptyTitle")).toBeInTheDocument()
    apiFetch.mockRejectedValueOnce(new Error("x"))
    await userEvent.click(screen.getByText("common.refresh"))
    expect(await screen.findByText("common.errorLoading")).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText("closeMessage"))
    expect(screen.queryByText("common.errorLoading")).toBeNull()
    second.unmount()
  })
})
