import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"

const auth = { login: vi.fn() }
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => auth }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../../lib/api.js"
import Login from "./Login.jsx"
import RedeemAccess from "./RedeemAccess.jsx"
import Landing from "../Landing.jsx"

function Where() {
  const location = useLocation()
  return <div data-testid="where">{location.pathname}{location.state?.email ? `|${location.state.email}` : ""}</div>
}

const renderAt = (element, route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={route.split("?")[0]} element={element} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  apiFetch.mockReset()
  auth.login.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
})

describe("Login", () => {
  const fill = (email, password) => {
    fireEvent.change(screen.getByPlaceholderText("seu@email.ht"), { target: { value: email } })
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: password } })
  }

  it("validates required fields", async () => {
    apiFetch.mockRejectedValue(new Error("no test creds"))
    renderAt(<Login />, "/login")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByText("emailRequired")).toBeInTheDocument()
    fill("a@b.c", "")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByText("passwordRequired")).toBeInTheDocument()
  })

  it.each([
    [{ role: "ADMIN" }, "/admin"],
    [{ role: "TEACHER" }, "/teacher"],
    [{ role: "OWNER" }, "/owner"],
    [{ role: "STUDENT" }, "/student"],
    [{ role: "ADMIN", mustChangePassword: true }, "/change-password"],
    [null, "/student"],
  ])("logs %j in and redirects to %s", async (user, path) => {
    apiFetch.mockImplementation(async (p) => (p === "/auth/login" ? { token: "t", user } : {}))
    renderAt(<Login />, "/login")
    fill("a@b.c", "pw")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByTestId("where")).toHaveTextContent(path)
    expect(auth.login).toHaveBeenCalledWith("t", user)
  })

  it.each([
    ["Invalid credentials", "invalidCredentials"],
    ["401 nope", "invalidCredentials"],
    ["Unauthorized", "invalidCredentials"],
    ["Temporary password expired", "temporaryPasswordExpired"],
    ["Request failed", "serverError"],
    ["", "serverError"],
    ["Something else", "errorOccurred"],
  ])("maps the error %j", async (message, key) => {
    apiFetch.mockImplementation(async (p) => {
      if (p === "/auth/login") throw new Error(message)
      return {}
    })
    renderAt(<Login />, "/login")
    fill("a@b.c", "pw")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByText(key)).toBeInTheDocument()
  })

  it("lists test accounts and logs in with one", async () => {
    apiFetch.mockImplementation(async (p) => {
      if (p === "/auth/test-credentials")
        return { admin: { role: "ADMIN", email: "admin@x", password: "a" }, teacher: null, student: { role: "STUDENT", email: "s@x", password: "s" } }
      return { token: "t", user: { role: "ADMIN" } }
    })
    renderAt(<Login />, "/login")
    await userEvent.click(await screen.findByText("admin@x"))
    expect(await screen.findByTestId("where")).toHaveTextContent("/admin")
    expect(apiFetch).toHaveBeenCalledWith("/auth/login", { method: "POST", body: { email: "admin@x", password: "a" } })
  })

  it("shows the loading state", async () => {
    apiFetch.mockImplementation(async (p) => (p === "/auth/login" ? new Promise(() => {}) : {}))
    renderAt(<Login />, "/login")
    fill("a@b.c", "pw")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByText("loading")).toBeInTheDocument()
  })
})

describe("RedeemAccess", () => {
  const fillAccount = () => {
    fireEvent.change(screen.getByPlaceholderText("fullNamePlaceholder"), { target: { value: "Jean" } })
    fireEvent.change(screen.getByPlaceholderText("seu@email.ht"), { target: { value: "j@x.ht" } })
  }

  it("lets the user type a code and continue to the account form", async () => {
    renderAt(<RedeemAccess />, "/redeem-access")
    fireEvent.change(screen.getByPlaceholderText("XXXXXXXX"), { target: { value: "abcd1234" } })
    expect(screen.getByPlaceholderText("XXXXXXXX")).toHaveValue("ABCD1234")
    fireEvent.submit(screen.getByText("continue").closest("form"))
    expect(await screen.findByText("createSchoolAccount")).toBeInTheDocument()
    apiFetch.mockResolvedValue({ schoolName: "Lycée" })
    fillAccount()
    fireEvent.submit(screen.getByText("createAccount").closest("form"))
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/owner-auth/verify-permission-code", {
        method: "POST",
        body: { code: "ABCD1234", email: "j@x.ht", name: "Jean" },
      }),
    )
  })

  it("redeems a code from the URL and redirects to login", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    apiFetch.mockResolvedValue({ schoolName: "Lycée" })
    renderAt(<RedeemAccess />, "/redeem-access?code=XYZ")
    fillAccount()
    fireEvent.submit(screen.getByText("createAccount").closest("form"))
    expect(await screen.findByText("Lycée")).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2100))
    expect(await screen.findByTestId("where")).toHaveTextContent("/login|j@x.ht")
  })

  it("shows errors, sends no empty name and links to login", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Invalid or expired permission code")).mockRejectedValueOnce(new Error(""))
    renderAt(<RedeemAccess />, "/redeem-access?code=XYZ")
    fireEvent.change(screen.getByPlaceholderText("seu@email.ht"), { target: { value: "j@x.ht" } })
    fireEvent.submit(screen.getByText("createAccount").closest("form"))
    expect(await screen.findByText("Invalid or expired permission code")).toBeInTheDocument()
    expect(apiFetch.mock.calls[0][1].body.name).toBeUndefined()
    fireEvent.submit(screen.getByText("createAccount").closest("form"))
    expect(await screen.findByText("redeemInvalidCode")).toBeInTheDocument()
    await userEvent.click(screen.getByText("loginHere"))
    expect(screen.getByTestId("where")).toHaveTextContent("/login")
  })

  it("shows a one-time temporary password and waits for the user when e-mail failed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    apiFetch.mockResolvedValue({ schoolName: "Lycée", tempPassword: "Abc123XyZ9", emailSent: false })
    renderAt(<RedeemAccess />, "/redeem-access?code=XYZ")
    fillAccount()
    fireEvent.submit(screen.getByText("createAccount").closest("form"))
    expect(await screen.findByTestId("temp-password")).toHaveTextContent("Abc123XyZ9")
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByTestId("where")).toBeNull()
    fireEvent.click(screen.getByText("goToLogin"))
    expect(await screen.findByTestId("where")).toHaveTextContent("/login|j@x.ht")
  })

  it("shows the creating label", async () => {
    apiFetch.mockImplementation(() => new Promise(() => {}))
    renderAt(<RedeemAccess />, "/redeem-access?code=XYZ")
    fireEvent.submit(screen.getByText("createAccount").closest("form"))
    expect(await screen.findByText("creatingAccount")).toBeInTheDocument()
  })
})

describe("Landing", () => {
  it("renders the marketing page with links", () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    )
    expect(screen.getAllByText("brand").length).toBeGreaterThan(0)
    expect(screen.getAllByText("metricAttendance").length).toBeGreaterThan(0)
    expect(screen.getAllByRole("link").length).toBeGreaterThan(0)
  })
})
