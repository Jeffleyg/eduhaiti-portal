import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"

const auth = { token: "tok", refreshProfile: vi.fn(async () => {}) }
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => auth }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn(), apiUpload: vi.fn() }))

import { apiFetch, apiUpload } from "../../lib/api.js"
import UserProfile from "./UserProfile.jsx"

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

const renderProfile = () =>
  render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/profile" element={<UserProfile />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

const student = {
  role: "STUDENT",
  email: "s@x",
  firstName: "Ana",
  lastName: "Lima",
  dateOfBirth: "2012-03-04T00:00:00Z",
  address: "Rue 1",
  gender: "FEMALE",
  fatherName: "Pai",
  motherName: "Mae",
  enrollmentNumber: "E1",
}

beforeEach(() => {
  apiFetch.mockReset()
  apiUpload.mockReset()
  auth.token = "tok"
  auth.refreshProfile.mockClear()
})

describe("UserProfile", () => {
  it("shows the profile and navigates through quick actions", async () => {
    apiFetch.mockResolvedValue(student)
    renderProfile()
    expect(await screen.findByText("Ana")).toBeInTheDocument()
    expect(screen.getByText("FEMALE")).toBeInTheDocument()
    expect(screen.getAllByText("rolestudent").length).toBeGreaterThan(0)
    await userEvent.click(screen.getByText("profileDocuments"))
    expect(screen.getByTestId("where")).toHaveTextContent("/student/resources")
  })

  it.each([
    ["profileAcademicHistory", "/student/grades"],
    ["profileMessages", "/student/messages"],
  ])("quick action %s", async (label, path) => {
    apiFetch.mockResolvedValue(student)
    renderProfile()
    await userEvent.click(await screen.findByText(label))
    expect(screen.getByTestId("where")).toHaveTextContent(path)
  })

  it.each([
    ["ADMIN", "/admin/settings", "roleadmin"],
    ["TEACHER", "/teacher/settings", "roleprofessor"],
    ["OWNER", "/owner/settings", "OWNER"],
    ["WEIRD", "/student/settings", "WEIRD"],
  ])("opens the settings for %s", async (role, path, label) => {
    apiFetch.mockResolvedValue({ role, email: "x@y" })
    renderProfile()
    expect(await screen.findAllByText(label)).not.toHaveLength(0)
    expect(screen.queryByText("profileQuickAccess")).toBeNull()
    await userEvent.click(screen.getAllByTitle("settings")[0])
    expect(screen.getByTestId("where")).toHaveTextContent(path)
  })

  it("edits and saves the profile", async () => {
    apiFetch.mockImplementation(async (path, options = {}) => (options.method === "PUT" ? {} : student))
    const { container } = renderProfile()
    await screen.findByText("Ana")
    await userEvent.click(screen.getAllByText("edit").find((el) => el.tagName === "BUTTON"))
    const inputs = container.querySelectorAll("form input")
    fireEvent.change(inputs[0], { target: { value: "Anna" } })
    fireEvent.change(inputs[1], { target: { value: "L" } })
    fireEvent.change(inputs[2], { target: { value: "" } })
    fireEvent.change(inputs[3], { target: { value: "Rue 2" } })
    fireEvent.change(inputs[4], { target: { value: "P" } })
    fireEvent.change(inputs[5], { target: { value: "M" } })
    fireEvent.change(container.querySelector("form select"), { target: { value: "" } })
    fireEvent.submit(container.querySelector("form"))
    expect(await screen.findByText("profileSaved")).toBeInTheDocument()
    const put = apiFetch.mock.calls.find((c) => c[1]?.method === "PUT")[1].body
    expect(put).toEqual({
      firstName: "Anna",
      lastName: "L",
      dateOfBirth: undefined,
      address: "Rue 2",
      gender: undefined,
      fatherName: "P",
      motherName: "M",
    })
    expect(auth.refreshProfile).toHaveBeenCalled()
  })

  it("cancels editing in both places and reports save errors", async () => {
    apiFetch.mockImplementation(async (path, options = {}) => {
      if (options.method === "PUT") throw new Error("save failed")
      return { role: "TEACHER" }
    })
    const { container } = renderProfile()
    expect(await screen.findAllByText("-")).not.toHaveLength(0)
    await userEvent.click(screen.getAllByText("edit").find((el) => el.tagName === "BUTTON"))
    await userEvent.click(screen.getAllByText("cancel")[1])
    expect(screen.queryByText("save")).toBeNull()
    await userEvent.click(screen.getByTitle("editProfile"))
    await userEvent.click(screen.getAllByText("cancel")[0])
    await userEvent.click(screen.getAllByText("edit").find((el) => el.tagName === "BUTTON"))
    fireEvent.submit(container.querySelector("form"))
    expect(await screen.findByText("save failed")).toBeInTheDocument()
  })

  it("uploads a photo with either response shape and reports errors", async () => {
    apiFetch.mockResolvedValue(student)
    apiUpload
      .mockResolvedValueOnce({ ...student, firstName: "Direct" })
      .mockResolvedValueOnce({ user: student })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error(""))
    const { container } = renderProfile()
    await screen.findByText("Ana")
    const input = container.querySelector('input[type="file"]')
    const file = new File(["x"], "me.png", { type: "image/png" })

    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText("photoUpdatedSuccess")).toBeInTheDocument()
    expect(apiUpload.mock.calls[0][1].formData.get("profilePhoto")).toBe(file)
    expect(auth.refreshProfile).toHaveBeenCalled()

    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(apiUpload).toHaveBeenCalledTimes(2))
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(apiUpload).toHaveBeenCalledTimes(3))
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText("errorUploadingPhoto")).toBeInTheDocument()
  })

  it("handles load errors, missing token and the saving label", async () => {
    apiFetch.mockRejectedValueOnce(new Error("load failed"))
    const first = renderProfile()
    expect(await screen.findByText("load failed")).toBeInTheDocument()
    first.unmount()

    apiFetch.mockImplementation(async (path, options = {}) => (options.method === "PUT" ? new Promise(() => {}) : student))
    const { container } = renderProfile()
    await screen.findByText("Ana")
    await userEvent.click(screen.getAllByText("edit").find((el) => el.tagName === "BUTTON"))
    fireEvent.submit(container.querySelector("form"))
    expect(await screen.findAllByText("loading")).not.toHaveLength(0)
  })

  it("stays on the skeleton without a token", () => {
    auth.token = null
    const { container } = renderProfile()
    expect(container.querySelector(".skeleton-card")).not.toBeNull()
    expect(apiFetch).not.toHaveBeenCalled()
  })
})
