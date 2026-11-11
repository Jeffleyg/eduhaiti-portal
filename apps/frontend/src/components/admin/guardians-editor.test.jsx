import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../../lib/api.js"
import GuardiansEditor from "./GuardiansEditor.jsx"

beforeEach(() => {
  apiFetch.mockReset()
})

describe("GuardiansEditor", () => {
  it("loads the current guardians and saves only filled phones", async () => {
    apiFetch.mockImplementation(async (path, options = {}) =>
      options.method === "PUT"
        ? []
        : [
            { relationship: "FATHER", fullName: "Jean", phoneNumber: "+50937123456" },
            { relationship: "GUARDIAN", fullName: "Tia", phoneNumber: "1" },
            { relationship: "MOTHER", fullName: null, phoneNumber: null },
          ],
    )
    render(<GuardiansEditor studentId="st" token="tok" onClose={vi.fn()} />)
    expect(screen.getByText("loading")).toBeInTheDocument()
    expect(await screen.findByDisplayValue("Jean")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/users/students/st/guardians", { token: "tok" })
    expect(screen.getByLabelText("motherPhone")).toHaveValue("")

    fireEvent.change(screen.getByLabelText("motherPhone"), { target: { value: " 3800 0000 " } })
    fireEvent.change(screen.getByLabelText("fatherName"), { target: { value: " " } })
    fireEvent.submit(screen.getByRole("form"))
    expect(await screen.findByText("guardiansSaved")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenLastCalledWith("/admin/users/students/st/guardians", {
      method: "PUT",
      token: "tok",
      body: {
        guardians: [
          { relationship: "FATHER", fullName: "Pai", phoneNumber: "+50937123456" },
          { relationship: "MOTHER", fullName: "Mãe", phoneNumber: "3800 0000" },
        ],
      },
    })
  })

  it("can clear every phone, shows errors and closes", async () => {
    const onClose = vi.fn()
    apiFetch.mockResolvedValueOnce(null)
    render(<GuardiansEditor studentId="st" token="tok" onClose={onClose} />)
    await waitFor(() => expect(screen.queryByText("loading")).toBeNull())
    fireEvent.change(screen.getByLabelText("motherName"), { target: { value: "Rose" } })

    apiFetch.mockRejectedValueOnce(new Error("Invalid phone number"))
    fireEvent.submit(screen.getByRole("form"))
    expect(await screen.findByText("Invalid phone number")).toBeInTheDocument()
    expect(apiFetch.mock.calls[1][1].body).toEqual({ guardians: [] })

    apiFetch.mockImplementationOnce(() => new Promise(() => {}))
    fireEvent.submit(screen.getByRole("form"))
    expect(await screen.findByText("loading")).toBeInTheDocument()

    await userEvent.click(screen.getByText("adminCancel"))
    expect(onClose).toHaveBeenCalled()
  })

  it("reports load errors and ignores answers after unmount", async () => {
    apiFetch.mockRejectedValueOnce(new Error("forbidden"))
    render(<GuardiansEditor studentId="st" token="tok" onClose={vi.fn()} />)
    expect(await screen.findByText("forbidden")).toBeInTheDocument()

    let resolve
    apiFetch.mockImplementationOnce(() => new Promise((r) => (resolve = r)))
    const late = render(<GuardiansEditor studentId="st2" token="tok" onClose={vi.fn()} />)
    late.unmount()
    resolve([{ relationship: "FATHER", fullName: "Late", phoneNumber: "1" }])
    await Promise.resolve()
    expect(screen.queryByDisplayValue("Late")).toBeNull()

    let reject
    apiFetch.mockImplementationOnce(() => new Promise((_, r) => (reject = r)))
    const failing = render(<GuardiansEditor studentId="st3" token="tok" onClose={vi.fn()} />)
    failing.unmount()
    reject(new Error("late failure"))
    await Promise.resolve()
    expect(screen.queryByText("late failure")).toBeNull()
  })
})
