import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Route, Routes } from "react-router-dom"
import { renderWithRouter } from "../../test/utils.jsx"

const auth = { token: "tok", user: { role: "ADMIN" }, refreshProfile: vi.fn(async () => {}) }
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => auth }))
vi.mock("../../lib/api.js", () => ({ apiFetch: vi.fn() }))

import { apiFetch } from "../../lib/api.js"
import ChangePassword from "./ChangePassword.jsx"

const renderPage = () =>
  renderWithRouter(
    <Routes>
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/admin" element={<div>admin-home</div>} />
      <Route path="/teacher" element={<div>teacher-home</div>} />
      <Route path="/student" element={<div>student-home</div>} />
    </Routes>,
    { route: "/change-password" },
  )

const fill = (current, next, confirm) => {
  const inputs = document.querySelectorAll('input[type="password"]')
  fireEvent.change(inputs[0], { target: { value: current } })
  fireEvent.change(inputs[1], { target: { value: next } })
  fireEvent.change(inputs[2], { target: { value: confirm } })
}

beforeEach(() => {
  apiFetch.mockReset()
  auth.refreshProfile.mockClear()
})

describe("ChangePassword", () => {
  it("validates required and matching passwords", async () => {
    renderPage()
    await userEvent.click(screen.getByText("changePasswordAction"))
    expect(screen.getByText("passwordRequired")).toBeInTheDocument()
    fill("old", "new1", "new2")
    await userEvent.click(screen.getByText("changePasswordAction"))
    expect(screen.getByText("passwordMismatch")).toBeInTheDocument()
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it.each([
    ["ADMIN", "admin-home"],
    ["TEACHER", "teacher-home"],
    ["STUDENT", "student-home"],
    [undefined, "student-home"],
  ])("updates the password and redirects %s users", async (role, home) => {
    auth.user = role ? { role } : null
    apiFetch.mockResolvedValue({ success: true })
    renderPage()
    fill("old", "new", "new")
    await userEvent.click(screen.getByText("changePasswordAction"))
    expect(await screen.findByText(home)).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/auth/change-password", {
      method: "POST",
      token: "tok",
      body: { currentPassword: "old", newPassword: "new" },
    })
    expect(auth.refreshProfile).toHaveBeenCalled()
  })

  it("shows API errors and a fallback message", async () => {
    let reject
    apiFetch.mockImplementationOnce(() => new Promise((_r, rej) => (reject = rej)))
    renderPage()
    fill("old", "new", "new")
    await userEvent.click(screen.getByText("changePasswordAction"))
    expect(screen.getByText("loading")).toBeInTheDocument()
    reject(new Error("wrong current password"))
    expect(await screen.findByText("wrong current password")).toBeInTheDocument()

    apiFetch.mockRejectedValueOnce(new Error(""))
    await userEvent.click(screen.getByText("changePasswordAction"))
    await waitFor(() => expect(screen.getByText("passwordUpdateFailed")).toBeInTheDocument())
  })
})
