import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../test/utils.jsx"

const auth = { token: "tok", user: { role: "STUDENT" } }
vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => auth }))
vi.mock("../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../lib/api.js"
import StudentAcademicRequests from "./student/StudentAcademicRequests.jsx"
import ProfessorAcademicRequests from "./professor/ProfessorAcademicRequests.jsx"

const request = (over = {}) => ({
  id: "r1",
  title: "Need letter",
  type: "ENROLLMENT_LETTER",
  status: "PENDING",
  details: "Please",
  student: { name: "Ana" },
  class: { name: "3e" },
  ...over,
})

beforeEach(() => {
  apiFetch.mockReset()
  auth.token = "tok"
  auth.user = { role: "STUDENT" }
})

describe("StudentAcademicRequests", () => {
  it("lists requests and submits a new one", async () => {
    apiFetch.mockImplementation(async (path, options = {}) => {
      if (path === "/classes/my-classes") return [{ id: "c1", name: "3e", level: "A" }]
      if (path === "/academic-requests/me")
        return [
          request({ reviewedBy: { name: "Prof" }, resolutionComment: "Done", status: "APPROVED" }),
          request({ id: "r2", reviewedBy: { email: "rev@x" } }),
          request({ id: "r3", reviewedBy: null }),
        ]
      if (options.method === "POST") return {}
      return null
    })
    renderWithRouter(<StudentAcademicRequests />)
    expect(await screen.findByText("academicRequestStatus_APPROVED")).toBeInTheDocument()
    expect(screen.getByText("academicRequestResolution: Done")).toBeInTheDocument()

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "c1" } })
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "GRADE_REVIEW" } })
    fireEvent.change(screen.getByPlaceholderText("academicRequestSubject"), { target: { value: "Review" } })
    fireEvent.change(screen.getByPlaceholderText("academicRequestDetails"), { target: { value: "Math" } })
    await userEvent.click(screen.getByText("academicRequestSubmit"))
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/academic-requests", {
        method: "POST",
        token: "tok",
        body: { classId: "c1", type: "GRADE_REVIEW", title: "Review", details: "Math" },
      }),
    )
  })

  it("shows the message after submitting without class", async () => {
    let calls = 0
    apiFetch.mockImplementation(async (path, options = {}) => {
      if (options.method === "POST") return {}
      if (path === "/academic-requests/me") return calls++ === 0 ? [] : null
      return null
    })
    renderWithRouter(<StudentAcademicRequests />)
    expect(await screen.findByText("noData")).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText("academicRequestSubject"), { target: { value: "T" } })
    fireEvent.change(screen.getByPlaceholderText("academicRequestDetails"), { target: { value: "D" } })
    fireEvent.submit(screen.getByText("academicRequestSubmit").closest("form"))
    expect(await screen.findByText("academicRequestCreated")).toBeInTheDocument()
    expect(apiFetch.mock.calls.find((c) => c[1]?.method === "POST")[1].body.classId).toBeUndefined()
  })

  it("shows load and submit errors", async () => {
    apiFetch.mockRejectedValueOnce(new Error("load error")).mockResolvedValue([])
    renderWithRouter(<StudentAcademicRequests />)
    expect(await screen.findByText("load error")).toBeInTheDocument()

    apiFetch.mockReset()
    apiFetch.mockRejectedValue(new Error("submit error"))
    fireEvent.submit(screen.getByText("academicRequestSubmit").closest("form"))
    expect(await screen.findByText("submit error")).toBeInTheDocument()
  })

  it("does not load without a token", () => {
    auth.token = null
    renderWithRouter(<StudentAcademicRequests />)
    expect(apiFetch).not.toHaveBeenCalled()
  })
})

describe("ProfessorAcademicRequests", () => {
  it("loads classes for teachers and admins and filters requests", async () => {
    auth.user = { role: "TEACHER" }
    apiFetch.mockImplementation(async (path) => {
      if (path === "/classes/my-classes" || path === "/admin/classes") return [{ id: "c1", name: "3e", level: "A" }]
      if (path.startsWith("/academic-requests")) return [request(), request({ id: "r2", student: { email: "s@x" }, class: null })]
      return null
    })
    const { unmount } = renderWithRouter(<ProfessorAcademicRequests />)
    expect(await screen.findAllByText("Need letter")).toHaveLength(2)
    expect(apiFetch).toHaveBeenCalledWith("/classes/my-classes", { token: "tok" })
    expect(screen.getByText("Ana | 3e")).toBeInTheDocument()

    const [classFilter, statusFilter] = screen.getAllByRole("combobox")
    fireEvent.change(classFilter, { target: { value: "c1" } })
    fireEvent.change(statusFilter, { target: { value: "PENDING" } })
    await userEvent.click(screen.getByText("academicReviewLoad"))
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/academic-requests?classId=c1&status=PENDING", { token: "tok" }),
    )
    unmount()

    auth.user = { role: "ADMIN" }
    renderWithRouter(<ProfessorAcademicRequests />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/admin/classes", { token: "tok" }))
  })

  it("reviews a request with defaults and custom values", async () => {
    apiFetch.mockImplementation(async (path, options = {}) => {
      if (options.method === "PATCH") return {}
      if (path.startsWith("/academic-requests")) return [request()]
      return null
    })
    renderWithRouter(<ProfessorAcademicRequests />)
    await screen.findByText("Need letter")
    await userEvent.click(screen.getByText("academicReviewAction"))
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/academic-requests/r1/review", {
        method: "PATCH",
        token: "tok",
        body: { status: "IN_REVIEW", resolutionComment: undefined },
      }),
    )
    expect(await screen.findByText("academicReviewSaved")).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("academicRequestResolution"), { target: { value: "No" } })
    fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "REJECTED" } })
    await userEvent.click(screen.getByText("academicReviewAction"))
    await waitFor(() =>
      expect(apiFetch).toHaveBeenLastCalledWith("/academic-requests", { token: "tok" }),
    )
    expect(apiFetch.mock.calls.find((c) => c[1]?.body?.status === "REJECTED")[1].body).toEqual({
      status: "REJECTED",
      resolutionComment: "No",
    })
  })

  it("reports errors and empty lists", async () => {
    apiFetch.mockImplementation(async (path, options = {}) => {
      if (path === "/classes/my-classes") throw new Error("classes error")
      if (options.method === "PATCH") throw new Error("review error")
      return null
    })
    renderWithRouter(<ProfessorAcademicRequests />)
    expect(await screen.findByText("noData")).toBeInTheDocument()
    expect(screen.getByText("classes error")).toBeInTheDocument()

    apiFetch.mockImplementation(async (path, options = {}) => {
      if (options.method === "PATCH") throw new Error("review error")
      if (path.startsWith("/academic-requests")) return [request()]
      return []
    })
    await userEvent.click(screen.getByText("academicReviewLoad"))
    await userEvent.click(await screen.findByText("academicReviewAction"))
    expect(await screen.findByText("review error")).toBeInTheDocument()

    apiFetch.mockRejectedValue(new Error("requests error"))
    await userEvent.click(screen.getByText("academicReviewLoad"))
    expect(await screen.findByText("requests error")).toBeInTheDocument()
  })

  it("does not load without a token", () => {
    auth.token = null
    renderWithRouter(<ProfessorAcademicRequests />)
    expect(apiFetch).not.toHaveBeenCalled()
  })
})
