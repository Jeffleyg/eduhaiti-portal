import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { renderWithRouter } from "../test/utils.jsx"

const auth = { token: "tok", user: { name: "Admin" } }
vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => auth }))
const survival = { disableBackgroundSync: false }
vi.mock("../context/useSurvivalMode.js", () => ({ useSurvivalMode: () => survival }))
vi.mock("../context/useSyncControl.js", () => ({ useSyncControl: () => ({ syncRevision: 0 }) }))
vi.mock("../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../lib/api.js"
import { writeHomeCache } from "../offline/sqliteCache.js"
import Modal from "../components/Modal.jsx"
import AnnouncementCard, { TypeBadge } from "../components/announcements/AnnouncementCard.jsx"
import EmergencyBanner from "../components/announcements/EmergencyBanner.jsx"
import LatestAnnouncements from "../components/announcements/LatestAnnouncements.jsx"
import {
  announcementStatus,
  formatDateTime,
  relativeTime,
  toLocalInput,
  typeMeta,
} from "../components/announcements/announcementMeta.js"
import Announcements from "./common/Announcements.jsx"
import AdminAnnouncements from "./admin/AdminAnnouncements.jsx"

const HOUR = 3600 * 1000
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString()
const make = (over = {}) => ({
  id: over.id ?? "a1",
  title: "Réunion",
  content: "Vendredi 14 h",
  type: "GENERAL",
  publishedAt: iso(-HOUR),
  expiresAt: null,
  createdBy: { id: "u", name: "Marie Joseph" },
  ...over,
})

beforeEach(() => {
  apiFetch.mockReset()
  auth.token = "tok"
  survival.disableBackgroundSync = false
})
afterEach(() => {
  vi.useRealTimers()
})

describe("announcement helpers", () => {
  it("derives status, type metadata and dates", () => {
    expect(announcementStatus(make())).toBe("live")
    expect(announcementStatus(make({ publishedAt: iso(HOUR) }))).toBe("scheduled")
    expect(announcementStatus(make({ expiresAt: iso(-1000) }))).toBe("expired")
    expect(announcementStatus(make({ expiresAt: iso(HOUR) }))).toBe("live")
    expect(typeMeta("EMERGENCY").labelKey).toBe("announcementTypeEMERGENCY")
    expect(typeMeta("UNKNOWN").labelKey).toBe("announcementTypeGENERAL")
    expect(relativeTime(iso(-3 * 24 * HOUR))).toMatch(/3/)
    expect(relativeTime(iso(2 * HOUR))).toMatch(/2/)
    expect(relativeTime(iso(-5000))).toBeTruthy()
    expect(formatDateTime("2026-11-21T10:00:00.000Z")).toMatch(/2026/)
    expect(toLocalInput("")).toBe("")
    expect(toLocalInput(null)).toBe("")
    expect(toLocalInput(new Date(2026, 10, 21, 9, 5).toISOString())).toBe("2026-11-21T09:05")
  })
})

describe("AnnouncementCard", () => {
  it("expands long messages and shows the author", () => {
    const long = "x".repeat(400)
    render(<AnnouncementCard announcement={make({ content: long, type: "EMERGENCY" })} />)
    expect(screen.getByText("announcementBy")).toBeInTheDocument()
    expect(screen.getByText(/…$/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "readMore" }))
    expect(screen.getByText(long)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "showLess" }))
    expect(screen.getByRole("article")).toHaveClass("border-brand-red/30")
  })

  it("is compact without author and handles missing content", () => {
    render(
      <>
        <AnnouncementCard announcement={make({ content: undefined, createdBy: null })} compact />
        <TypeBadge type="EVENT" />
      </>,
    )
    expect(screen.queryByRole("button", { name: "readMore" })).toBeNull()
    expect(screen.queryByText("announcementBy")).toBeNull()
    expect(screen.getByText("announcementTypeEVENT")).toBeInTheDocument()
  })
})

describe("Announcements feed", () => {
  it("loads, caches and filters by type", async () => {
    apiFetch.mockResolvedValue([make(), make({ id: "a2", title: "Fermeture", type: "EMERGENCY" })])
    renderWithRouter(<Announcements />)
    expect(document.querySelector("[aria-busy=true]")).toBeInTheDocument()
    expect(await screen.findByText("Fermeture")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/announcements", { token: "tok" })
    expect(JSON.parse(localStorage.getItem("eduhaiti_sqlite_home_cache_v1")).announcementsFeed).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "announcementTypeEMERGENCY" }))
    expect(screen.queryByText("Réunion")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "all" }))
    expect(screen.getByText("Réunion")).toBeInTheDocument()
  })

  it("shows cached items with an error, and an empty state", async () => {
    writeHomeCache("announcementsFeed", [make()])
    apiFetch.mockRejectedValueOnce(new Error("down"))
    const { unmount } = renderWithRouter(<Announcements />)
    expect(screen.getByText("Réunion")).toBeInTheDocument()
    expect(await screen.findByRole("alert")).toHaveTextContent("announcementsLoadError")
    expect(screen.queryByRole("group")).toBeNull()
    unmount()

    localStorage.clear()
    apiFetch.mockResolvedValueOnce(null)
    renderWithRouter(<Announcements />)
    expect(await screen.findByText("announcementsEmpty")).toBeInTheDocument()
  })

  it("does not fetch in survival mode", () => {
    survival.disableBackgroundSync = true
    renderWithRouter(<Announcements />)
    expect(screen.getByText("announcementsEmpty")).toBeInTheDocument()
    expect(apiFetch).not.toHaveBeenCalled()
  })
})

describe("LatestAnnouncements", () => {
  it("renders the latest items with a link, or nothing", async () => {
    apiFetch.mockResolvedValueOnce([make()])
    const { unmount } = renderWithRouter(<LatestAnnouncements to="/student/announcements" />)
    expect(await screen.findByText("Réunion")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/announcements/latest?limit=3", { token: "tok" })
    expect(screen.getByRole("link", { name: "dashboardSeeAll" })).toHaveAttribute("href", "/student/announcements")
    unmount()

    apiFetch.mockRejectedValueOnce(new Error("down"))
    const second = renderWithRouter(<LatestAnnouncements to="/x" />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2))
    expect(second.container).toBeEmptyDOMElement()
    second.unmount()

    apiFetch.mockResolvedValueOnce({})
    const third = renderWithRouter(<LatestAnnouncements to="/x" />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3))
    expect(third.container).toBeEmptyDOMElement()
    third.unmount()

    auth.token = null
    renderWithRouter(<LatestAnnouncements to="/x" />)
    expect(apiFetch).toHaveBeenCalledTimes(3)
  })
})

describe("EmergencyBanner", () => {
  it("shows the latest emergency until dismissed, remembering it", async () => {
    apiFetch.mockResolvedValue([make({ id: "e1", title: "Fermeture", type: "EMERGENCY" }), make({ id: "e2", title: "Cyclone", type: "EMERGENCY" })])
    localStorage.setItem("eduhaiti_dismissed_alerts", JSON.stringify(["gone"]))
    const { unmount } = renderWithRouter(<EmergencyBanner to="/student/announcements" />)
    expect(await screen.findByText("Fermeture")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/announcements?type=EMERGENCY", { token: "tok" })
    expect(screen.getByRole("link", { name: "readMore" })).toHaveAttribute("href", "/student/announcements")

    fireEvent.click(screen.getByRole("button", { name: "dismissAlert" }))
    expect(await screen.findByText("Cyclone")).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem("eduhaiti_dismissed_alerts"))).toEqual(["e1"])
    fireEvent.click(screen.getByRole("button", { name: "dismissAlert" }))
    expect(screen.queryByRole("alert")).toBeNull()
    unmount()

    renderWithRouter(<EmergencyBanner />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("survives a broken dismissal store, errors and missing sessions", async () => {
    localStorage.setItem("eduhaiti_dismissed_alerts", "{broken")
    apiFetch.mockResolvedValueOnce([make({ type: "EMERGENCY", title: "Alerte" })])
    const { unmount } = renderWithRouter(<EmergencyBanner />)
    expect(await screen.findByText("Alerte")).toBeInTheDocument()
    expect(screen.queryByRole("link")).toBeNull()
    unmount()

    localStorage.setItem("eduhaiti_dismissed_alerts", JSON.stringify({ not: "a list" }))
    apiFetch.mockResolvedValueOnce(null)
    const second = renderWithRouter(<EmergencyBanner />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2))
    second.unmount()

    apiFetch.mockRejectedValueOnce(new Error("down"))
    const third = renderWithRouter(<EmergencyBanner />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3))
    expect(screen.queryByRole("alert")).toBeNull()
    third.unmount()

    survival.disableBackgroundSync = true
    renderWithRouter(<EmergencyBanner />)
    expect(apiFetch).toHaveBeenCalledTimes(3)
  })
})

describe("Modal", () => {
  it("is an accessible dialog that closes with Escape", () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="Titre">
        corps
      </Modal>,
    )
    expect(screen.getByRole("dialog", { name: "Titre" })).toHaveAttribute("aria-modal", "true")
    fireEvent.keyDown(document, { key: "Enter" })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe("AdminAnnouncements", () => {
  const list = () => [
    make({ id: "live", title: "En ligne", expiresAt: iso(48 * HOUR) }),
    make({ id: "sched", title: "Programmée", type: "ACADEMIC", publishedAt: iso(24 * HOUR) }),
    make({ id: "old", title: "Ancienne", type: "EVENT", publishedAt: iso(-72 * HOUR), expiresAt: iso(-HOUR) }),
  ]
  const dialog = () => screen.getByRole("dialog")

  it("lists every status with counts and filters", async () => {
    apiFetch.mockResolvedValue(list())
    renderWithRouter(<AdminAnnouncements />)
    expect(await screen.findByText("En ligne")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/announcements?include=all", { token: "tok" })
    expect(screen.getByRole("button", { name: "all · 3" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("announcementScheduledFor")).toBeInTheDocument()
    expect(screen.getAllByText("announcementExpiresOn")).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: "announcementStatus_scheduled · 1" }))
    expect(screen.queryByText("En ligne")).toBeNull()
    expect(screen.getByText("Programmée")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "announcementStatus_live · 1" }))
    expect(screen.getByText("En ligne")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "announcementStatus_expired · 1" }))
    expect(screen.getByText("Ancienne")).toBeInTheDocument()
  })

  it("shows the first-run state, load errors and empty filters", async () => {
    apiFetch.mockResolvedValueOnce(null)
    const { unmount } = renderWithRouter(<AdminAnnouncements />)
    expect(await screen.findByText("announcementsAdminEmpty")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "announcementFirst" }))
    expect(dialog()).toBeInTheDocument()
    unmount()

    apiFetch.mockRejectedValueOnce(new Error("down"))
    const second = renderWithRouter(<AdminAnnouncements />)
    expect(await screen.findByRole("alert")).toHaveTextContent("announcementsLoadError")
    second.unmount()

    apiFetch.mockResolvedValueOnce([list()[0]])
    renderWithRouter(<AdminAnnouncements />)
    await screen.findByText("En ligne")
    fireEvent.click(screen.getByRole("button", { name: "announcementStatus_expired · 0" }))
    expect(screen.getByText("announcementsEmpty")).toBeInTheDocument()
  })

  it("validates and creates a scheduled announcement with a preview", async () => {
    apiFetch.mockResolvedValueOnce([]).mockResolvedValueOnce({ id: "new" }).mockResolvedValueOnce([make({ id: "new", title: "Examens" })])
    renderWithRouter(<AdminAnnouncements />)
    fireEvent.click(await screen.findByRole("button", { name: "announcementNew" }))
    const form = () => document.getElementById("announcement-form")

    // Preview uses placeholders until the form is filled.
    expect(within(dialog()).getAllByText("announcementTitlePlaceholder").length).toBeGreaterThan(0)

    fireEvent.submit(form())
    expect(within(dialog()).getByRole("alert")).toHaveTextContent("announcementTitleRequired")
    fireEvent.change(screen.getByLabelText("announcementTitle"), { target: { value: " Examens " } })
    fireEvent.submit(form())
    expect(within(dialog()).getByRole("alert")).toHaveTextContent("announcementContentRequired")
    fireEvent.change(screen.getByLabelText("announcementContent"), { target: { value: "Semaine prochaine" } })

    fireEvent.click(within(dialog()).getByLabelText("announcementTypeEMERGENCY"))
    expect(screen.getByText("announcementEmergencyHint")).toBeInTheDocument()
    fireEvent.click(within(dialog()).getByLabelText("announcementTypeACADEMIC"))

    fireEvent.click(screen.getByRole("button", { name: "announcementLater" }))
    fireEvent.submit(form())
    expect(within(dialog()).getByRole("alert")).toHaveTextContent("announcementPublishDateRequired")
    fireEvent.change(screen.getByLabelText("announcementPublishedAt"), { target: { value: toLocalInput(iso(48 * HOUR)) } })
    fireEvent.change(screen.getByLabelText("announcementExpiresAt"), { target: { value: toLocalInput(iso(24 * HOUR)) } })
    fireEvent.submit(form())
    expect(within(dialog()).getByRole("alert")).toHaveTextContent("announcementExpiryAfterPublish")
    fireEvent.change(screen.getByLabelText("announcementExpiresAt"), { target: { value: toLocalInput(iso(96 * HOUR)) } })
    expect(within(dialog()).getByText("Examens")).toBeInTheDocument()

    fireEvent.click(within(dialog()).getByRole("button", { name: "announcementSchedule" }))
    expect(await screen.findByRole("status")).toHaveTextContent("announcementCreated")
    const [path, options] = apiFetch.mock.calls[1]
    expect(path).toBe("/announcements")
    expect(options).toMatchObject({ method: "POST", token: "tok" })
    expect(options.body).toMatchObject({ title: "Examens", content: "Semaine prochaine", type: "ACADEMIC" })
    expect(new Date(options.body.publishedAt).getTime()).toBeGreaterThan(Date.now())
    expect(options.body.expiresAt).toBeTruthy()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("edits: publishes a scheduled one now, clears the expiry and reports errors", async () => {
    const scheduled = make({ id: "s", title: "Plus tard", publishedAt: iso(24 * HOUR), expiresAt: iso(48 * HOUR) })
    apiFetch.mockImplementation(async (path, options = {}) => {
      if (options.method === "PUT") {
        if (options.body.title === "boom") throw new Error("expiresAt must be after")
        if (options.body.title === "fail") throw new Error("Request failed")
        return { id: "s" }
      }
      return [scheduled]
    })
    renderWithRouter(<AdminAnnouncements />)
    fireEvent.click(await screen.findByRole("button", { name: "announcementEditNamed" }))
    expect(screen.getByLabelText("announcementTitle")).toHaveValue("Plus tard")
    expect(screen.getByRole("button", { name: "announcementLater" })).toHaveAttribute("aria-pressed", "true")

    fireEvent.change(screen.getByLabelText("announcementTitle"), { target: { value: "boom" } })
    fireEvent.click(within(dialog()).getByRole("button", { name: "announcementSchedule" }))
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent("announcementExpiryAfterPublish")

    fireEvent.change(screen.getByLabelText("announcementTitle"), { target: { value: "fail" } })
    fireEvent.click(within(dialog()).getByRole("button", { name: "announcementSchedule" }))
    await waitFor(() => expect(within(dialog()).getByRole("alert")).toHaveTextContent("announcementSaveError"))

    fireEvent.change(screen.getByLabelText("announcementTitle"), { target: { value: "Maintenant" } })
    fireEvent.click(screen.getByRole("button", { name: "announcementNow" }))
    fireEvent.change(screen.getByLabelText("announcementExpiresAt"), { target: { value: "" } })
    fireEvent.click(within(dialog()).getByRole("button", { name: "save" }))
    expect(await screen.findByRole("status")).toHaveTextContent("announcementUpdated")
    const put = apiFetch.mock.calls.filter(([, o]) => o?.method === "PUT").at(-1)
    expect(put[0]).toBe("/announcements/s")
    expect(put[1].body.expiresAt).toBeNull()
    expect(new Date(put[1].body.publishedAt).getTime()).toBeLessThanOrEqual(Date.now())
  })

  it("edits a live one without touching its dates, and cancels with the button", async () => {
    apiFetch.mockImplementation(async (path, options = {}) => (options.method === "PUT" ? { id: "l" } : [make({ id: "l" })]))
    renderWithRouter(<AdminAnnouncements />)
    fireEvent.click(await screen.findByRole("button", { name: "announcementEditNamed" }))
    fireEvent.click(within(dialog()).getByRole("button", { name: "cancel" }))
    expect(screen.queryByRole("dialog")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "announcementEditNamed" }))
    fireEvent.click(within(dialog()).getByRole("button", { name: "save" }))
    await screen.findByRole("status")
    const put = apiFetch.mock.calls.find(([, o]) => o?.method === "PUT")
    expect(put[1].body).not.toHaveProperty("publishedAt")
    expect(put[1].body).not.toHaveProperty("expiresAt")
  })

  it("shows the saving label", async () => {
    apiFetch.mockResolvedValueOnce([]).mockReturnValueOnce(new Promise(() => {}))
    renderWithRouter(<AdminAnnouncements />)
    fireEvent.click(await screen.findByRole("button", { name: "announcementNew" }))
    fireEvent.change(screen.getByLabelText("announcementTitle"), { target: { value: "T" } })
    fireEvent.change(screen.getByLabelText("announcementContent"), { target: { value: "C" } })
    fireEvent.click(within(dialog()).getByRole("button", { name: "announcementPublish" }))
    expect(await within(dialog()).findByRole("button", { name: "loading" })).toBeDisabled()
  })

  it("deletes after confirmation and reports failures", async () => {
    let fail = false
    apiFetch.mockImplementation(async (path, options = {}) => {
      if (options.method === "DELETE") {
        if (fail) throw new Error("down")
        return { success: true }
      }
      return [make({ id: "d", title: "À supprimer" })]
    })
    renderWithRouter(<AdminAnnouncements />)
    fireEvent.click(await screen.findByRole("button", { name: "announcementDeleteNamed" }))
    expect(dialog()).toHaveTextContent("announcementDeleteText")
    fireEvent.click(within(dialog()).getByRole("button", { name: "cancel" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "announcementDeleteNamed" }))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "announcementDeleteNamed" }))
    fireEvent.click(within(dialog()).getByRole("button", { name: "delete" }))
    expect(await screen.findByRole("status")).toHaveTextContent("announcementDeleted")
    expect(apiFetch).toHaveBeenCalledWith("/announcements/d", { method: "DELETE", token: "tok" })

    fail = true
    fireEvent.click(screen.getByRole("button", { name: "announcementDeleteNamed" }))
    fireEvent.click(within(dialog()).getByRole("button", { name: "delete" }))
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("announcementDeleteError"))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("shows the deleting label", async () => {
    apiFetch.mockImplementation(async (path, options = {}) =>
      options.method === "DELETE" ? new Promise(() => {}) : [make({ id: "d" })],
    )
    renderWithRouter(<AdminAnnouncements />)
    fireEvent.click(await screen.findByRole("button", { name: "announcementDeleteNamed" }))
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole("button", { name: "delete" }))
    })
    expect(within(dialog()).getByRole("button", { name: "loading" })).toBeDisabled()
  })
})
