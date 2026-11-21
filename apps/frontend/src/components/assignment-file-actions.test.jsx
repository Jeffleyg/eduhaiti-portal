import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: "tok" }) }))
vi.mock("../lib/api", async (orig) => ({ ...(await orig()), apiFetchBlob: vi.fn() }))

import { apiFetchBlob } from "../lib/api"
import AssignmentFileActions from "./AssignmentFileActions.jsx"

const blob = new Blob(["pdf"], { type: "application/pdf" })

beforeEach(() => {
  apiFetchBlob.mockReset()
  URL.createObjectURL = vi.fn(() => "blob:doc")
  URL.revokeObjectURL = vi.fn()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const renderActions = (props = {}) =>
  render(<AssignmentFileActions path="/assignments/a/file" fileName="enonce.pdf" label="doc" {...props} />)

describe("AssignmentFileActions", () => {
  it("opens the document in a new tab with the user's token", async () => {
    const viewer = { location: { href: "" }, close: vi.fn() }
    vi.spyOn(window, "open").mockReturnValue(viewer)
    apiFetchBlob.mockResolvedValue(blob)
    renderActions()
    expect(screen.getByText("doc:")).toBeInTheDocument()
    expect(screen.getByText("enonce.pdf")).toBeInTheDocument()

    await userEvent.click(screen.getByText("viewFile"))
    expect(window.open).toHaveBeenCalledWith("", "_blank")
    expect(apiFetchBlob).toHaveBeenCalledWith("/assignments/a/file", { token: "tok" })
    expect(viewer.location.href).toBe("blob:doc")
    vi.advanceTimersByTime(60_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:doc")
  })

  it("downloads the document under its own name", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      expect(this.download).toBe("enonce.pdf")
      expect(this.href).toBe("blob:doc")
    })
    vi.spyOn(window, "open")
    apiFetchBlob.mockResolvedValue(blob)
    renderActions()
    await userEvent.click(screen.getByText("download"))
    expect(click).toHaveBeenCalledTimes(1)
    expect(window.open).not.toHaveBeenCalled()
    expect(document.querySelector("a[download]")).toBeNull()
  })

  it("falls back to a download when the new tab is blocked", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      expect(this.download).toBe("file")
    })
    vi.spyOn(window, "open").mockReturnValue(null)
    apiFetchBlob.mockResolvedValue(blob)
    renderActions({ fileName: null, label: undefined })
    expect(screen.getByText("fileUnnamed")).toBeInTheDocument()
    await userEvent.click(screen.getByText("viewFile"))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it("reports refused or failed downloads and shows progress", async () => {
    const viewer = { location: { href: "" }, close: vi.fn() }
    vi.spyOn(window, "open").mockReturnValue(viewer)
    apiFetchBlob.mockRejectedValueOnce(new Error("Not allowed to read this submission"))
    renderActions()
    await userEvent.click(screen.getByText("viewFile"))
    expect(await screen.findByRole("alert")).toHaveTextContent("Not allowed to read this submission")
    expect(viewer.close).toHaveBeenCalled()

    apiFetchBlob.mockRejectedValueOnce(new Error(""))
    await userEvent.click(screen.getByText("download"))
    expect(await screen.findByRole("alert")).toHaveTextContent("fileOpenError")

    apiFetchBlob.mockImplementationOnce(() => new Promise(() => {}))
    await userEvent.click(screen.getByText("download"))
    expect(screen.getByText("loading")).toBeInTheDocument()
    expect(screen.getByText("viewFile").closest("button")).toBeDisabled()
  })
})
