import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../../test/utils.jsx"

const auth = { token: "tok" }
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => auth }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../../lib/api.js"
import AdminFamilyCommunication from "./AdminFamilyCommunication.jsx"
import AdminStudentManagement from "./AdminStudentManagement.jsx"

beforeEach(() => {
  apiFetch.mockReset()
  auth.token = "tok"
})

describe("AdminFamilyCommunication", () => {
  const requests = [
    {
      requestId: "r1",
      subject: "Boletim",
      student: { name: "Ana" },
      enrollmentNumber: "E1",
      guardianName: "Marie",
      guardianPhone: "509",
      createdAt: "2026-01-01T00:00:00Z",
      status: "PENDING",
      body: "Quando sai?",
    },
    {
      requestId: "r2",
      createdAt: "2026-01-02T00:00:00Z",
      status: "RESPONDED",
      body: "Ok",
      response: { responseMessage: "Respondido", respondedAt: "2026-01-03T00:00:00Z" },
    },
  ]

  it("sends a notice and reloads requests", async () => {
    apiFetch.mockResolvedValue(null)
    renderWithRouter(<AdminFamilyCommunication />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/family/admin/contact-requests", { token: "tok" }))
    fireEvent.change(screen.getByPlaceholderText("studentEnrollmentPlaceholder"), { target: { value: "E1" } })
    const [severity, channel] = screen.getAllByRole("combobox")
    fireEvent.change(severity, { target: { value: "urgent" } })
    fireEvent.change(channel, { target: { value: "BOTH" } })
    fireEvent.change(screen.getByPlaceholderText("guardianPhonePlaceholder"), { target: { value: "509" } })
    fireEvent.change(screen.getByPlaceholderText("noticeTitlePlaceholder"), { target: { value: "Aviso" } })
    fireEvent.change(screen.getByPlaceholderText("noticeBodyPlaceholder"), { target: { value: "Texto" } })
    fireEvent.submit(screen.getByText("sendNotice").closest("form"))
    expect(await screen.findByText("Comunicado enviado para a familia com sucesso.")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/family/admin/notices", {
      method: "POST",
      token: "tok",
      body: { enrollmentNumber: "E1", title: "Aviso", body: "Texto", severity: "urgent", channel: "BOTH", guardianPhone: "509" },
    })
    expect(screen.getByPlaceholderText("noticeTitlePlaceholder")).toHaveValue("")
    expect(apiFetch.mock.calls.filter((c) => c[0] === "/family/admin/contact-requests")).toHaveLength(2)
  })

  it("warns when SMS was requested but nobody could be texted", async () => {
    apiFetch.mockImplementation(async (path) => (path === "/family/admin/notices" ? { smsWithoutRecipient: true } : []))
    renderWithRouter(<AdminFamilyCommunication />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1))
    fireEvent.submit(screen.getByText("sendNotice").closest("form"))
    expect(await screen.findByText("Comunicado registrado. familySmsNoRecipient")).toBeInTheDocument()
  })

  it("reports notice errors and shows the sending label", async () => {
    apiFetch.mockResolvedValueOnce([])
    renderWithRouter(<AdminFamilyCommunication />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1))
    apiFetch.mockRejectedValueOnce(new Error("notice failed"))
    fireEvent.submit(screen.getByText("sendNotice").closest("form"))
    expect(await screen.findByText("notice failed")).toBeInTheDocument()
    expect(apiFetch.mock.calls[1][1].body.guardianPhone).toBeUndefined()

    apiFetch.mockImplementationOnce(() => new Promise(() => {}))
    fireEvent.submit(screen.getByText("sendNotice").closest("form"))
    expect(await screen.findByText("sending")).toBeInTheDocument()
  })

  it("lists requests and responds to one", async () => {
    apiFetch.mockResolvedValue(requests)
    renderWithRouter(<AdminFamilyCommunication />)
    await userEvent.click(screen.getByText("familyRequests"))
    expect(await screen.findByText("Boletim")).toBeInTheDocument()
    expect(screen.getByText("noSubject")).toBeInTheDocument()
    expect(screen.getByText(/\| phoneLabel 509/)).toBeInTheDocument()
    expect(screen.getByText("responded")).toBeInTheDocument()
    expect(screen.getByText("pending")).toBeInTheDocument()
    expect(screen.getByText("Respondido")).toBeInTheDocument()

    await userEvent.click(screen.getByText("respondFamily"))
    expect(await screen.findByText("Escreva uma resposta antes de enviar.")).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("familyResponsePlaceholder"), { target: { value: " Sai amanhã " } })
    await userEvent.click(screen.getByText("respondFamily"))
    expect(await screen.findByText("Resposta enviada para a familia.")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/family/admin/contact-requests/r1/respond", {
      method: "POST",
      token: "tok",
      body: { responseMessage: "Sai amanhã", notifyFamily: true },
    })
    expect(screen.getByPlaceholderText("familyResponsePlaceholder")).toHaveValue("")
  })

  it("handles respond errors, the responding label, refresh and empty/failed loads", async () => {
    apiFetch.mockResolvedValue([requests[0]])
    renderWithRouter(<AdminFamilyCommunication />)
    await userEvent.click(screen.getByText("familyRequests"))
    await screen.findByText("Boletim")

    fireEvent.change(screen.getByPlaceholderText("familyResponsePlaceholder"), { target: { value: "x" } })
    apiFetch.mockRejectedValueOnce(new Error("respond failed"))
    await userEvent.click(screen.getByText("respondFamily"))
    expect(await screen.findByText("respond failed")).toBeInTheDocument()

    apiFetch.mockImplementationOnce(() => new Promise(() => {}))
    await userEvent.click(screen.getByText("respondFamily"))
    expect(await screen.findByText("sendingResponse")).toBeInTheDocument()
  })

  it("refreshes, shows loading, empty and error states", async () => {
    apiFetch.mockResolvedValueOnce(null)
    renderWithRouter(<AdminFamilyCommunication />)
    await userEvent.click(screen.getByText("familyRequests"))
    expect(await screen.findByText("noFamilyRequests")).toBeInTheDocument()

    apiFetch.mockImplementationOnce(() => new Promise(() => {}))
    await userEvent.click(screen.getByText("refresh"))
    expect(await screen.findByText("updating")).toBeInTheDocument()
    expect(screen.getByText("loadingRequests")).toBeInTheDocument()
  })

  it("shows load errors and skips loading without token", async () => {
    apiFetch.mockRejectedValueOnce(new Error("load failed"))
    const first = renderWithRouter(<AdminFamilyCommunication />)
    expect(await screen.findByText("load failed")).toBeInTheDocument()
    first.unmount()
    apiFetch.mockClear()
    auth.token = null
    renderWithRouter(<AdminFamilyCommunication />)
    await userEvent.click(screen.getByText("composeMessage"))
    expect(apiFetch).not.toHaveBeenCalled()
  })
})

describe("AdminStudentManagement", () => {
  const students = [
    { id: "s1", name: "Ana", email: "ana@x", enrollmentNumber: "E1", classesAttending: [{ id: "c1", name: "3e", level: "NS1" }] },
    { id: "s2", name: "Bob", email: "bob@x", enrollmentNumber: "E2", classesAttending: [] },
    { id: "s3", email: "noname@x", enrollmentNumber: "E3" },
  ]
  const classes = [
    { id: "c1", name: "3e", level: "NS1" },
    { id: "c2", name: "4e", level: "NS2" },
  ]
  const routes = () =>
    apiFetch.mockImplementation(async (path) => {
      if (path === "/admin/users/students") return students
      if (path === "/admin/classes") return classes
      return {}
    })

  it("lists students and filters them", async () => {
    routes()
    renderWithRouter(<AdminStudentManagement />)
    expect(await screen.findByText("total: 3 de 3")).toBeInTheDocument()
    expect(screen.getAllByText("adminNotEnrolled")).toHaveLength(2)

    fireEvent.change(screen.getByPlaceholderText("searchByNameEmail"), { target: { value: "BOB" } })
    expect(screen.getByText("total: 1 de 3")).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText("searchByNameEmail"), { target: { value: "noname" } })
    expect(screen.getByText("total: 1 de 3")).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText("searchByNameEmail"), { target: { value: "zzz" } })
    expect(screen.getByText("noData")).toBeInTheDocument()
    await userEvent.click(screen.getByText("clearFilters"))

    const [classFilter, statusFilter] = screen.getAllByRole("combobox")
    fireEvent.change(classFilter, { target: { value: "c1" } })
    expect(screen.getByText("total: 1 de 3")).toBeInTheDocument()
    fireEvent.change(classFilter, { target: { value: "" } })
    fireEvent.change(statusFilter, { target: { value: "enrolled" } })
    expect(screen.getByText("total: 1 de 3")).toBeInTheDocument()
    fireEvent.change(statusFilter, { target: { value: "not-enrolled" } })
    expect(screen.getByText("total: 2 de 3")).toBeInTheDocument()
  })

  it("enrolls a student in a class", async () => {
    routes()
    renderWithRouter(<AdminStudentManagement />)
    await screen.findByText("total: 3 de 3")
    await userEvent.click(screen.getAllByText("adminAddToClass")[1])
    await userEvent.click(screen.getByText("adminEnroll"))
    expect(await screen.findByText("adminSelectClassRequired")).toBeInTheDocument()

    await userEvent.click(screen.getByText("adminCancel"))
    expect(screen.queryByText("adminEnroll")).toBeNull()

    await userEvent.click(screen.getAllByText("adminAddToClass")[1])
    const selects = screen.getAllByRole("combobox")
    fireEvent.change(selects[selects.length - 1], { target: { value: "c2" } })
    await userEvent.click(screen.getByText("adminEnroll"))
    expect(await screen.findByText("adminStudentEnrolled")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/classes/c2/enroll", { method: "POST", token: "tok", body: { studentId: "s2" } })
    expect(screen.queryByText("adminEnroll")).toBeNull()
  })

  it("reports enroll errors", async () => {
    routes()
    renderWithRouter(<AdminStudentManagement />)
    await screen.findByText("total: 3 de 3")
    await userEvent.click(screen.getAllByText("adminAddToClass")[0])
    const selects = screen.getAllByRole("combobox")
    fireEvent.change(selects[selects.length - 1], { target: { value: "c2" } })
    apiFetch.mockRejectedValueOnce(new Error("enroll failed"))
    await userEvent.click(screen.getByText("adminEnroll"))
    expect(await screen.findByText("enroll failed")).toBeInTheDocument()
  })

  it("opens and closes the guardians editor per student", async () => {
    routes()
    renderWithRouter(<AdminStudentManagement />)
    await screen.findByText("total: 3 de 3")
    await userEvent.click(screen.getAllByText("guardiansTitle", { selector: "button" })[0])
    expect(await screen.findByRole("form", { name: "guardiansTitle" })).toBeInTheDocument()
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/admin/users/students/s1/guardians", { token: "tok" }))
    await userEvent.click(screen.getAllByText("guardiansTitle", { selector: "button" })[0])
    expect(screen.queryByRole("form", { name: "guardiansTitle" })).toBeNull()
    await userEvent.click(screen.getAllByText("guardiansTitle", { selector: "button" })[1])
    await userEvent.click(await screen.findByText("adminCancel", { selector: "button[type=button]" }))
    expect(screen.queryByRole("form", { name: "guardiansTitle" })).toBeNull()
  })

  it("removes a student from a class and reports errors", async () => {
    routes()
    renderWithRouter(<AdminStudentManagement />)
    await screen.findByText("total: 3 de 3")
    await userEvent.click(screen.getByLabelText("adminRemoveFromClass 3e"))
    expect(await screen.findByText("adminStudentRemoved")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/classes/c1/students/s1", { method: "DELETE", token: "tok" })

    apiFetch.mockRejectedValueOnce(new Error("remove failed"))
    await userEvent.click(screen.getByLabelText("adminRemoveFromClass 3e"))
    expect(await screen.findByText("remove failed")).toBeInTheDocument()
  })

  it("handles empty and failed loads and no token", async () => {
    apiFetch.mockResolvedValue(null)
    const first = renderWithRouter(<AdminStudentManagement />)
    expect(await screen.findByText("total: 0 de 0")).toBeInTheDocument()
    first.unmount()

    apiFetch.mockRejectedValue(new Error("load failed"))
    const second = renderWithRouter(<AdminStudentManagement />)
    expect(await screen.findByText("load failed")).toBeInTheDocument()
    second.unmount()

    apiFetch.mockClear()
    auth.token = null
    renderWithRouter(<AdminStudentManagement />)
    expect(screen.getByText("noData")).toBeInTheDocument()
    expect(apiFetch).not.toHaveBeenCalled()
  })
})
