import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"

const auth = { login: vi.fn() }
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => auth }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../../lib/api.js"
import { passwordChecks, passwordStrength } from "../../lib/password.js"
import ForgotPassword from "./ForgotPassword.jsx"
import ResetPassword from "./ResetPassword.jsx"
import Login from "./Login.jsx"

const TOKEN = "a".repeat(64)

function Where() {
  const location = useLocation()
  return (
    <div data-testid="where">
      {location.pathname}
      {location.state ? `|${JSON.stringify(location.state)}` : ""}
    </div>
  )
}

const renderAt = (element, entry) => {
  const pathname = (typeof entry === "string" ? entry : entry.pathname).split("?")[0]
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={pathname} element={element} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiFetch.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe("password helpers", () => {
  it("checks the rules and grades the strength", () => {
    expect(passwordChecks()).toEqual({ length: false, mix: false, symbol: false, match: false })
    expect(passwordChecks("Abcdefg1", "Abcdefg1")).toEqual({ length: true, mix: true, symbol: true, match: true })
    expect(passwordStrength("")).toBe(0)
    expect(passwordStrength("Ab1")).toBe(1)
    expect(passwordStrength("abcdefgh")).toBe(1)
    expect(passwordStrength("Abcdefgh")).toBe(2)
    expect(passwordStrength("Abcdefg1")).toBe(3)
  })
})

describe("ForgotPassword", () => {
  const typeEmail = (value) => fireEvent.change(screen.getByLabelText("email"), { target: { value } })

  it("requires an e-mail and maps errors", async () => {
    renderAt(<ForgotPassword />, "/forgot-password")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByRole("alert")).toHaveTextContent("emailRequired")

    apiFetch.mockRejectedValueOnce(new Error("email must be an email"))
    typeEmail("nope")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByRole("alert")).toHaveTextContent("invalidEmail")

    apiFetch.mockRejectedValueOnce(new Error("Request failed"))
    fireEvent.submit(document.querySelector("form"))
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("serverError"))
  })

  it("prefills the e-mail from the login page and confirms the request", async () => {
    apiFetch.mockResolvedValue({ success: true })
    renderAt(<ForgotPassword />, { pathname: "/forgot-password", state: { email: "eleve@eduhaiti.ht" } })
    expect(screen.getByLabelText("email")).toHaveValue("eleve@eduhaiti.ht")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByText("resetLinkSentTitle")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/auth/forgot-password", {
      method: "POST",
      body: { email: "eleve@eduhaiti.ht" },
    })
    expect(screen.queryByText("openResetLink")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "resendLinkIn" })).toBeDisabled()
  })

  it("shows the development link, counts down, resends and can switch e-mail", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    apiFetch.mockResolvedValueOnce({ success: true, devResetUrl: "http://x/reset-password?token=1" })
    renderAt(<ForgotPassword />, "/forgot-password")
    typeEmail(" a@b.c ")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByText("openResetLink")).toHaveAttribute("href", "http://x/reset-password?token=1")

    expect(screen.getByRole("button", { name: "resendLinkIn" })).toBeDisabled()
    for (let second = 0; second <= 60; second++) {
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })
    }
    const resend = screen.getByRole("button", { name: "resendLink" })
    expect(resend).toBeEnabled()

    apiFetch.mockRejectedValueOnce(new Error("Request failed"))
    fireEvent.click(resend)
    expect(await screen.findByRole("alert")).toHaveTextContent("serverError")
    expect(apiFetch).toHaveBeenLastCalledWith("/auth/forgot-password", { method: "POST", body: { email: "a@b.c" } })

    fireEvent.click(screen.getByRole("button", { name: "useAnotherEmail" }))
    expect(screen.getByText("forgotPasswordTitle")).toBeInTheDocument()
  })

  it("shows the loading label while sending", async () => {
    apiFetch.mockReturnValue(new Promise(() => {}))
    renderAt(<ForgotPassword />, "/forgot-password")
    typeEmail("a@b.c")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByRole("button", { name: "loading" })).toBeDisabled()
  })
})

describe("ResetPassword", () => {
  const fill = (password, confirmation = password) => {
    fireEvent.change(screen.getByLabelText("newPassword"), { target: { value: password } })
    fireEvent.change(screen.getByLabelText("confirmPassword"), { target: { value: confirmation } })
  }

  it("rejects a missing or malformed token without calling the API", () => {
    renderAt(<ResetPassword />, "/reset-password?token=abc")
    expect(screen.getByText("resetLinkInvalidTitle")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "requestNewLink" })).toHaveAttribute("href", "/forgot-password")
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it("reports a link the server says is no longer valid", async () => {
    apiFetch.mockResolvedValueOnce({ valid: false })
    renderAt(<ResetPassword />, `/reset-password?token=${TOKEN}`)
    expect(screen.getByText("checkingResetLink")).toBeInTheDocument()
    expect(await screen.findByText("resetLinkInvalidTitle")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/auth/reset-password/check", { method: "POST", body: { token: TOKEN } })
  })

  it("validates, shows strength and toggles visibility", async () => {
    apiFetch.mockRejectedValueOnce(new Error("offline"))
    renderAt(<ResetPassword />, `/reset-password?token=${TOKEN}`)
    expect(await screen.findByText("resetPasswordTitle")).toBeInTheDocument()

    fireEvent.submit(document.querySelector("form"))
    expect(screen.getByRole("alert")).toHaveTextContent("passwordRuleLength")

    fill("abcdefgh", "different")
    expect(screen.getByText("passwordStrength")).toBeInTheDocument()
    fireEvent.submit(document.querySelector("form"))
    expect(screen.getByRole("alert")).toHaveTextContent("passwordMismatch")

    const input = screen.getByLabelText("newPassword")
    expect(input).toHaveAttribute("type", "password")
    fireEvent.click(screen.getByRole("button", { name: "showPassword" }))
    expect(input).toHaveAttribute("type", "text")
    fireEvent.click(screen.getByRole("button", { name: "hidePassword" }))
    expect(input).toHaveAttribute("type", "password")
  })

  it("saves the password and sends the user to login with a notice", async () => {
    apiFetch.mockResolvedValueOnce({ valid: true }).mockResolvedValueOnce({ success: true })
    renderAt(<ResetPassword />, `/reset-password?token=${TOKEN}`)
    await screen.findByText("resetPasswordTitle")
    fill("Nouveau@2026")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByText("passwordResetSuccessTitle")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenLastCalledWith("/auth/reset-password", {
      method: "POST",
      body: { token: TOKEN, newPassword: "Nouveau@2026" },
    })
    fireEvent.click(screen.getByRole("button", { name: "login" }))
    expect(screen.getByTestId("where")).toHaveTextContent('/login|{"notice":"passwordReset"}')
  })

  it("handles a link used in the meantime and server errors", async () => {
    apiFetch
      .mockResolvedValueOnce({ valid: true })
      .mockRejectedValueOnce(new Error("Request failed"))
      .mockReturnValueOnce(new Promise(() => {}))
    const { unmount } = renderAt(<ResetPassword />, `/reset-password?token=${TOKEN}`)
    await screen.findByText("resetPasswordTitle")
    fill("Nouveau@2026")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByRole("alert")).toHaveTextContent("serverError")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByRole("button", { name: "loading" })).toBeDisabled()
    unmount()

    apiFetch.mockReset()
    apiFetch.mockResolvedValueOnce({ valid: true }).mockRejectedValueOnce(new Error("Invalid or expired reset link"))
    renderAt(<ResetPassword />, `/reset-password?token=${TOKEN}`)
    await screen.findByText("resetPasswordTitle")
    fill("Nouveau@2026")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByText("resetLinkInvalidTitle")).toBeInTheDocument()
  })

  it("ignores a late token check after unmount", async () => {
    let resolve
    apiFetch.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    const { unmount } = renderAt(<ResetPassword />, `/reset-password?token=${TOKEN}`)
    unmount()
    await act(async () => resolve({ valid: true }))
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })
})

describe("Login integration", () => {
  it("links to password recovery with the typed e-mail and shows the reset notice", async () => {
    apiFetch.mockRejectedValue(new Error("no test creds"))
    renderAt(<Login />, { pathname: "/login", state: { notice: "passwordReset", email: "a@b.c" } })
    expect(screen.getByRole("status")).toHaveTextContent("passwordResetNotice")
    expect(screen.getByPlaceholderText("emailPlaceholder")).toHaveValue("a@b.c")
    fireEvent.click(screen.getByRole("link", { name: "forgotPassword" }))
    expect(screen.getByTestId("where")).toHaveTextContent('/forgot-password|{"email":"a@b.c"}')
  })

  it("links to password recovery without state when no e-mail is typed", async () => {
    apiFetch.mockRejectedValue(new Error("no test creds"))
    renderAt(<Login />, "/login")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("link", { name: "forgotPassword" }))
    expect(screen.getByTestId("where").textContent).toBe("/forgot-password")
  })
})
