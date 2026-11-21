import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: "tok" }) }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../../lib/api.js"
import AdminEarlyWarning from "./AdminEarlyWarning.jsx"

const rules = { windowDays: 30, chronicAbsences: 5, chronicRate: 0.35, minRecordsForRate: 4, gradeDrop: 3, alertCooldownDays: 7 }
const row = (over = {}) => ({
  studentId: "s1",
  studentName: "Jean Dupont",
  enrollmentNumber: "E1",
  className: "3e A",
  guardianFallbackName: null,
  guardians: [],
  currentRecords: 8,
  currentAbsences: 6,
  currentAbsenceRate: 0.75,
  previousAbsenceRate: 0,
  currentAverage: 13,
  previousAverage: null,
  absenceDelta: 0.75,
  gradeDelta: 0,
  chronicAbsence: true,
  suddenGradeDrop: false,
  atRisk: true,
  lastAlertAt: null,
  ...over,
})
const report = () => [
  row(),
  row({
    studentId: "s2",
    studentName: "Anne",
    className: null,
    currentAbsenceRate: 0.4,
    absenceDelta: -0.1,
    currentAverage: 7.5,
    previousAverage: 12,
    gradeDelta: -4.5,
    suddenGradeDrop: true,
    guardians: [{ name: "Marie", phone: "+509 3456 7890", relationship: "Mère" }, { name: "Paul", phone: "3333", relationship: null }],
    lastAlertAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  }),
  row({ studentId: "s3", studentName: null, enrollmentNumber: null, className: null, currentAbsenceRate: 0.9, guardianFallbackName: "Papa", absenceDelta: 0, currentAverage: null }),
  row({ studentId: "s4", studentName: "Calme", atRisk: false }),
]

beforeEach(() => {
  apiFetch.mockReset()
})

describe("AdminEarlyWarning", () => {
  it("explains the rules and lists at-risk students by priority", async () => {
    apiFetch.mockResolvedValue({ report: report(), rules })
    render(<AdminEarlyWarning />)
    expect(document.querySelector("[aria-busy=true]")).toBeInTheDocument()
    expect(await screen.findByText("earlyHowTitle")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/analytics/dashboard/early-alert", { token: "tok" })
    expect(screen.getByText("earlyRuleAbsence")).toBeInTheDocument()

    const cards = screen.getAllByRole("article")
    // Anne has both reasons; then the highest absence rate (s3, 90 %) before Jean (75 %).
    expect(within(cards[0]).getByText("Anne")).toBeInTheDocument()
    expect(within(cards[1]).getAllByText("–").length).toBe(2)
    expect(within(cards[2]).getByText("Jean Dupont")).toBeInTheDocument()
    expect(screen.queryByText("Calme")).toBeNull()

    // Anne: both badges, falling average, two guardians, last alert.
    expect(within(cards[0]).getByText("earlyGradeDrop")).toBeInTheDocument()
    expect(within(cards[0]).getByText("7,5/20")).toBeInTheDocument()
    expect(within(cards[0]).getByText("-4,5")).toHaveClass("text-brand-red")
    expect(within(cards[0]).getByRole("link", { name: "+509 3456 7890" })).toHaveAttribute("href", "tel:+50934567890")
    expect(within(cards[0]).getByText("(Mère)")).toBeInTheDocument()
    expect(within(cards[0]).getByText("earlyLastAlert")).toBeInTheDocument()
    expect(within(cards[0]).getByText(/-10 pts/)).toHaveClass("text-emerald-700")

    // No name, no class, no guardian phone but a parent name.
    expect(within(cards[1]).getByText("Papa ·", { exact: false })).toBeInTheDocument()
    expect(within(cards[1]).getByText("earlyNoGuardianPhone")).toBeInTheDocument()
    expect(within(cards[2]).getByText(/\+75 pts/)).toHaveClass("text-brand-red")
    expect(within(cards[2]).queryByText("earlyLastAlert")).toBeNull()
  })

  it("sends the digest and reports skipped students", async () => {
    apiFetch.mockImplementation(async (path, options = {}) =>
      options.method === "POST" ? { report: [], notification: { triggered: 2, skipped: 1, recipients: 3 } } : { report: report(), rules },
    )
    render(<AdminEarlyWarning />)
    fireEvent.click(await screen.findByRole("button", { name: "earlySendAction" }))
    expect(await screen.findByRole("status")).toHaveTextContent("earlySent earlySkipped")
    expect(apiFetch).toHaveBeenCalledWith("/analytics/dashboard/early-alert/trigger", { method: "POST", token: "tok" })
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3))
  })

  it("explains when everyone was already alerted, and sends without skipped count", async () => {
    let notification = { triggered: 0, skipped: 2, recipients: 0 }
    apiFetch.mockImplementation(async (path, options = {}) => (options.method === "POST" ? { notification } : { report: report(), rules }))
    render(<AdminEarlyWarning />)
    fireEvent.click(await screen.findByRole("button", { name: "earlySendAction" }))
    expect(await screen.findByRole("status")).toHaveTextContent("earlyAllAlreadySent")

    notification = { triggered: 1, recipients: 1 }
    fireEvent.click(screen.getByRole("button", { name: "earlySendAction" }))
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("earlySent"))

    apiFetch.mockImplementation(async (path, options = {}) => (options.method === "POST" ? {} : { report: report(), rules }))
    fireEvent.click(screen.getByRole("button", { name: "earlySendAction" }))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("earlyAllAlreadySent"))
  })

  it("reports send failures and shows the busy label", async () => {
    apiFetch.mockImplementation(async (path, options = {}) => {
      if (options.method === "POST") throw new Error("down")
      return { report: report(), rules }
    })
    const { unmount } = render(<AdminEarlyWarning />)
    fireEvent.click(await screen.findByRole("button", { name: "earlySendAction" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("earlySendError")
    unmount()

    apiFetch.mockImplementation((path, options = {}) => (options.method === "POST" ? new Promise(() => {}) : Promise.resolve({ report: report(), rules })))
    render(<AdminEarlyWarning />)
    fireEvent.click(await screen.findByRole("button", { name: "earlySendAction" }))
    expect(await screen.findByRole("button", { name: "loading" })).toBeDisabled()
  })

  it("shows the all-clear state, a payload without rules and load errors", async () => {
    apiFetch.mockResolvedValueOnce({ report: [row({ atRisk: false })] })
    const { unmount } = render(<AdminEarlyWarning />)
    expect(await screen.findByText("earlyNoneTitle")).toBeInTheDocument()
    expect(screen.queryByText("earlyRuleAbsence")).toBeNull()
    expect(screen.getByRole("button", { name: "earlySendAction" })).toBeDisabled()
    unmount()

    apiFetch.mockResolvedValueOnce(null)
    const second = render(<AdminEarlyWarning />)
    expect(await screen.findByText("earlyNoneTitle")).toBeInTheDocument()
    second.unmount()

    apiFetch.mockRejectedValueOnce(new Error("down"))
    render(<AdminEarlyWarning />)
    expect(await screen.findByRole("alert")).toHaveTextContent("earlyLoadError")
  })

  it("keeps the report on screen when a later refresh fails", async () => {
    apiFetch
      .mockResolvedValueOnce({ report: report(), rules })
      .mockResolvedValueOnce({ notification: { triggered: 1, recipients: 1 } })
      .mockRejectedValueOnce(new Error("down"))
    render(<AdminEarlyWarning />)
    fireEvent.click(await screen.findByRole("button", { name: "earlySendAction" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("earlyLoadError")
    expect(screen.getAllByRole("article").length).toBe(3)
  })

  it("shows a student flagged only for a grade drop", async () => {
    apiFetch.mockResolvedValueOnce({ report: [row({ chronicAbsence: false, suddenGradeDrop: true, gradeDelta: -3.5, previousAverage: 16.5 })], rules })
    render(<AdminEarlyWarning />)
    const card = await screen.findByRole("article")
    expect(within(card).getByText("earlyGradeDrop")).toBeInTheDocument()
    expect(within(card).queryByText("earlyChronicAbsence")).toBeNull()
  })
})
