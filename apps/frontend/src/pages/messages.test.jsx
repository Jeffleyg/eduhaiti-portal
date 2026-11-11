import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../test/utils.jsx"

vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: "tok" }) }))
vi.mock("../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../lib/api.js"
import StudentMessages from "./student/StudentMessages.jsx"
import ProfessorMessages from "./professor/ProfessorMessages.jsx"

const inbox = [
  { id: "m1", subject: "Hello", body: "Inbox body", from: { name: "Prof", role: "TEACHER" } },
  { id: "m2", subject: "NoRole", body: "b", from: { email: "x@y" } },
]
const sent = [
  { id: "s1", subject: "Sent one", body: "Sent body", to: { name: "Adm", role: "ADMIN" } },
  { id: "s2", subject: "Sent two", body: "b", to: { email: "z@y" } },
]
const recipients = [
  { id: "r1", name: "Teacher T", role: "TEACHER" },
  { id: "r2", email: "admin@x", role: "ADMIN" },
  { id: "r3", name: "NoRole" },
]

describe.each([
  ["StudentMessages", StudentMessages],
  ["ProfessorMessages", ProfessorMessages],
])("%s", (_name, Page) => {
  beforeEach(() => {
    apiFetch.mockReset()
  })

  const routes = (overrides = {}) =>
    apiFetch.mockImplementation(async (path, options = {}) => {
      const key = `${options.method ?? "GET"} ${path}`
      if (key in overrides) {
        const v = overrides[key]
        if (v instanceof Error) throw v
        return v
      }
      if (path === "/messages/inbox") return inbox
      if (path === "/messages/sent") return sent
      if (path === "/messages/recipients") return recipients
      return {}
    })

  it("lists inbox and sent messages with real names", async () => {
    routes()
    renderWithRouter(<Page />)
    expect(await screen.findByText("Hello")).toBeInTheDocument()
    expect(screen.getByText("Prof")).toBeInTheDocument()
    expect(screen.getByText("x@y")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Teacher T (roleprofessor)" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "admin@x (roleadmin)" })).toBeInTheDocument()
    await userEvent.click(screen.getByText("sentMessages"))
    expect(screen.getByText("Sent one")).toBeInTheDocument()
    await userEvent.click(screen.getByText("inbox"))
    expect(screen.getByText("Hello")).toBeInTheDocument()
  })

  it("validates and sends a message, then shows the sent tab", async () => {
    routes({ "POST /messages": {} })
    renderWithRouter(<Page />)
    await screen.findByText("Hello")
    await userEvent.click(screen.getByText("sendMessage"))
    expect(screen.getByText("messageRequiredFields")).toBeInTheDocument()

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "r1" } })
    fireEvent.change(screen.getByPlaceholderText("messageSubject"), { target: { value: " Hi " } })
    fireEvent.change(screen.getByPlaceholderText("messageBody"), { target: { value: " Body " } })
    await userEvent.click(screen.getByText("sendMessage"))
    expect(await screen.findByText("messageSent")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/messages", {
      method: "POST",
      token: "tok",
      body: { toId: "r1", subject: "Hi", body: "Body" },
    })
    expect(screen.getByText("Sent one")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("messageSubject")).toHaveValue("")
  })

  it("shows send errors and empty states", async () => {
    apiFetch.mockImplementation(async (path, options = {}) => {
      if (options.method === "POST") throw new Error("cannot send")
      if (path === "/messages/sent") return null
      if (path === "/messages/recipients") return [{ id: "r1", name: "T", role: "TEACHER" }]
      return null
    })
    renderWithRouter(<Page />)
    expect(await screen.findByText("noData")).toBeInTheDocument()
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "r1" } })
    fireEvent.change(screen.getByPlaceholderText("messageSubject"), { target: { value: "S" } })
    fireEvent.change(screen.getByPlaceholderText("messageBody"), { target: { value: "B" } })
    await userEvent.click(screen.getByText("sendMessage"))
    expect(await screen.findByText("cannot send")).toBeInTheDocument()
  })

  it("handles a null sent list after sending and loading failures", async () => {
    let sentCalls = 0
    apiFetch.mockImplementation(async (path, options = {}) => {
      if (options.method === "POST") return {}
      if (path === "/messages/sent") return sentCalls++ === 0 ? [] : null
      if (path === "/messages/recipients") return [{ id: "r1", name: "T", role: "ADMIN" }]
      return []
    })
    const first = renderWithRouter(<Page />)
    await screen.findByText("noData")
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "r1" } })
    fireEvent.change(screen.getByPlaceholderText("messageSubject"), { target: { value: "S" } })
    fireEvent.change(screen.getByPlaceholderText("messageBody"), { target: { value: "B" } })
    await userEvent.click(screen.getByText("sendMessage"))
    expect(await screen.findByText("messageSent")).toBeInTheDocument()
    first.unmount()

    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    apiFetch.mockRejectedValue(new Error("down"))
    renderWithRouter(<Page />)
    await waitFor(() => expect(error).toHaveBeenCalled())
    expect(screen.getByText("composeMessage")).toBeInTheDocument()
  })

  it("shows the loader and the submitting state", async () => {
    let resolve
    apiFetch.mockImplementationOnce(() => new Promise((r) => (resolve = r)))
    apiFetch.mockResolvedValue([])
    renderWithRouter(<Page />)
    expect(screen.getByText("loading")).toBeInTheDocument()
    resolve([])
    await screen.findByText("composeMessage")
  })
})
