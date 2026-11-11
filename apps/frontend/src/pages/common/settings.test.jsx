import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import i18n from "../../i18n.js"

const sync = { conflictStrategy: "lww", setConflictStrategy: vi.fn() }
vi.mock("../../context/useSyncControl.js", () => ({ useSyncControl: () => sync }))

import Settings from "./Settings.jsx"

const renderSettings = () =>
  render(
    <MemoryRouter initialEntries={["/prev", "/settings"]} initialIndex={1}>
      <Routes>
        <Route path="/settings" element={<Settings />} />
        <Route path="/prev" element={<div>previous-page</div>} />
      </Routes>
    </MemoryRouter>,
  )

describe("Settings", () => {
  beforeEach(() => {
    sync.conflictStrategy = "lww"
    sync.setConflictStrategy = vi.fn()
  })
  afterEach(async () => {
    await i18n.changeLanguage("cimode")
  })

  it("saves language, sync mode and notifications", async () => {
    renderSettings()
    fireEvent.change(screen.getByLabelText("selectLanguage"), { target: { value: "ht" } })
    fireEvent.change(screen.getByLabelText("syncMode"), { target: { value: "manual" } })
    await userEvent.click(screen.getByLabelText("notifications"))
    await userEvent.click(screen.getByText("save"))
    await waitFor(() => expect(sync.setConflictStrategy).toHaveBeenCalledWith("manual"))
    expect(i18n.language).toBe("ht")
    expect(localStorage.getItem("eduhaiti.settings.notifications")).toBe("false")
    expect(await screen.findByRole("status")).toBeInTheDocument()
  })

  it("reads stored preferences and defaults", async () => {
    localStorage.setItem("eduhaiti.settings.notifications", "false")
    sync.conflictStrategy = undefined
    renderSettings()
    expect(screen.getByLabelText("notifications")).not.toBeChecked()
    expect(screen.getByLabelText("syncMode")).toHaveValue("lww")
    await userEvent.click(screen.getByLabelText("notifications"))
    await userEvent.click(screen.getByText("save"))
    await waitFor(() => expect(localStorage.getItem("eduhaiti.settings.notifications")).toBe("true"))
  })

  it("survives unavailable storage", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    renderSettings()
    expect(screen.getByLabelText("notifications")).toBeChecked()
    await userEvent.click(screen.getByText("save"))
    expect(await screen.findByRole("status")).toBeInTheDocument()
  })

  it("still saves the other preferences when the language change fails", async () => {
    vi.spyOn(i18n, "changeLanguage").mockRejectedValueOnce(new Error("x"))
    renderSettings()
    fireEvent.change(screen.getByLabelText("syncMode"), { target: { value: "manual" } })
    await userEvent.click(screen.getByText("save"))
    expect(await screen.findByRole("status")).toBeInTheDocument()
    expect(sync.setConflictStrategy).toHaveBeenCalledWith("manual")
  })

  it("falls back to French when i18n has no language and goes back on cancel", async () => {
    const resolved = vi.spyOn(i18n, "resolvedLanguage", "get").mockReturnValue(undefined)
    const lang = vi.spyOn(i18n, "language", "get").mockReturnValue(undefined)
    renderSettings()
    expect(screen.getByLabelText("selectLanguage")).toHaveValue("fr")
    resolved.mockRestore()
    lang.mockRestore()
    await userEvent.click(screen.getByText("cancel"))
    expect(screen.getByText("previous-page")).toBeInTheDocument()
  })
})
