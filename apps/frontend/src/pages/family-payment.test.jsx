import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../test/utils.jsx"

vi.mock("../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../lib/api.js"
import FamilyPortal from "./FamilyPortal.jsx"
import GuardianTuitionPayment from "./GuardianTuitionPayment.jsx"

beforeEach(() => {
  apiFetch.mockReset()
})

describe("FamilyPortal", () => {
  const overview = {
    student: { name: "Ana", enrollmentNumber: "E1", classes: [{ name: "3e" }, { name: "4e" }] },
    grades: [{ id: "g1", score: 15, maxScore: 20, discipline: { name: "Math" }, class: { name: "3e" } }],
    attendance: [
      { date: "2026-01-02T08:00:00Z", status: "PRESENT", class: { name: "3e" }, remarks: "ok" },
      { date: "2026-01-05T08:00:00Z", status: "presente", class: { name: "3e" } },
      { date: "2026-01-03T08:00:00Z", status: "ABSENT" },
      { date: "2026-01-04T08:00:00Z", status: "ausente" },
      { date: "2026-01-01T08:00:00Z", status: "LATE" },
    ],
    announcements: [{ title: "Fête", content: "Samedi" }],
    familyNotices: [{ body: "Corpo", createdAt: "2026-01-01T00:00:00Z" }, { title: "T2", createdAt: "2026-01-02T00:00:00Z" }],
  }

  const routes = (data = overview) =>
    apiFetch.mockImplementation(async (path) => {
      if (path === "/family/access/request-code") return { sent: true }
      if (path === "/family/access/verify") return { token: "fam-token", guardianName: "Marie" }
      if (path === "/family/overview") return data
      return {}
    })

  const signIn = async () => {
    fireEvent.change(screen.getByPlaceholderText("familyEnrollmentPlaceholder"), { target: { value: " E1 " } })
    fireEvent.change(screen.getByPlaceholderText("familyPhonePlaceholder"), { target: { value: " 3712-3456 " } })
    fireEvent.submit(screen.getByText("familySendCode").closest("form"))
    expect(await screen.findByText("familyCodeSent")).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText("familyCodePlaceholder"), { target: { value: "12a3456789" } })
    expect(screen.getByPlaceholderText("familyCodePlaceholder")).toHaveValue("123456")
    fireEvent.submit(screen.getByText("consultFamilyData").closest("form"))
    expect(await screen.findByText("familyOverviewLoaded")).toBeInTheDocument()
  }

  it("signs in with an SMS code and shows the overview", async () => {
    routes()
    renderWithRouter(<FamilyPortal />)
    await signIn()
    expect(apiFetch).toHaveBeenCalledWith("/family/access/request-code", {
      method: "POST",
      body: { enrollmentNumber: "E1", phone: "3712-3456" },
    })
    expect(apiFetch).toHaveBeenCalledWith("/family/access/verify", {
      method: "POST",
      body: { enrollmentNumber: "E1", phone: "3712-3456", code: "123456" },
    })
    expect(apiFetch).toHaveBeenCalledWith("/family/overview", { token: "fam-token" })
    expect(screen.getByText("Aluno")).toBeInTheDocument()
    expect(screen.getByText("classesLabel: 3e, 4e")).toBeInTheDocument()
    expect(screen.getByText("Math - 3e")).toBeInTheDocument()
    expect(screen.getAllByText("2")).toHaveLength(2)
    expect(screen.getByText("remarksLabel: ok")).toBeInTheDocument()
    expect(screen.getByText("Fête")).toBeInTheDocument()
    expect(screen.getByText("Recado")).toBeInTheDocument()
    expect(screen.getByText("T2")).toBeInTheDocument()
    expect(screen.queryByPlaceholderText("familyPhonePlaceholder")).toBeNull()
  })

  it("lets the user go back, sign out and see errors", async () => {
    routes()
    renderWithRouter(<FamilyPortal />)
    fireEvent.change(screen.getByPlaceholderText("familyEnrollmentPlaceholder"), { target: { value: "E1" } })
    fireEvent.change(screen.getByPlaceholderText("familyPhonePlaceholder"), { target: { value: "37123456" } })
    fireEvent.submit(screen.getByText("familySendCode").closest("form"))
    await screen.findByText("familyCodeSent")
    expect(screen.getByText("consultFamilyData")).toBeDisabled()
    await userEvent.click(screen.getByText("familyChangeNumber"))
    expect(screen.getByPlaceholderText("familyPhonePlaceholder")).toHaveValue("37123456")

    fireEvent.submit(screen.getByText("familySendCode").closest("form"))
    await screen.findByText("familyCodeSent")
    apiFetch.mockRejectedValueOnce(new Error("Invalid or expired code"))
    fireEvent.change(screen.getByPlaceholderText("familyCodePlaceholder"), { target: { value: "000000" } })
    fireEvent.submit(screen.getByText("consultFamilyData").closest("form"))
    expect(await screen.findByText("Invalid or expired code")).toBeInTheDocument()

    fireEvent.submit(screen.getByText("consultFamilyData").closest("form"))
    expect(await screen.findByText("familyOverviewLoaded")).toBeInTheDocument()
    await userEvent.click(screen.getByText("familySignOut"))
    expect(screen.getByPlaceholderText("familyEnrollmentPlaceholder")).toBeInTheDocument()
    expect(screen.queryByText("studentProfileTitle")).toBeNull()
  })

  it("shows empty states", async () => {
    routes({ student: {} })
    renderWithRouter(<FamilyPortal />)
    await signIn()
    expect(screen.getByText("noGradesPublished")).toBeInTheDocument()
    expect(screen.getByText("classesLabel: -")).toBeInTheDocument()
    expect(screen.getByText("noAttendanceData")).toBeInTheDocument()
    expect(screen.getByText("noAnnouncements")).toBeInTheDocument()
    expect(screen.getByText("noSpecialNotices")).toBeInTheDocument()
  })

  it("sends a contact request with the family session and reports errors", async () => {
    routes()
    renderWithRouter(<FamilyPortal />)
    await signIn()
    fireEvent.change(screen.getByPlaceholderText("subjectPlaceholder"), { target: { value: "Assunto" } })
    fireEvent.change(screen.getByPlaceholderText("messagePlaceholder"), { target: { value: "Texto" } })
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.submit(screen.getByText("sendToSecretary").closest("form"))
    expect(await screen.findByText("familyMessageSent")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenLastCalledWith("/family/contact-request", {
      method: "POST",
      token: "fam-token",
      body: { subject: "Assunto", body: "Texto", urgent: true },
    })
    expect(screen.getByPlaceholderText("subjectPlaceholder")).toHaveValue("")

    apiFetch.mockRejectedValueOnce(new Error("send failed"))
    fireEvent.submit(screen.getByText("sendToSecretary").closest("form"))
    expect(await screen.findByText("send failed")).toBeInTheDocument()

    apiFetch.mockImplementationOnce(() => new Promise(() => {}))
    fireEvent.submit(screen.getByText("sendToSecretary").closest("form"))
    expect(await screen.findByText("sendingMessage")).toBeInTheDocument()
  })

  it("shows the loading label while requesting a code", async () => {
    apiFetch.mockImplementation(() => new Promise(() => {}))
    renderWithRouter(<FamilyPortal />)
    fireEvent.submit(screen.getByText("familySendCode").closest("form"))
    expect(await screen.findByText("loading")).toBeInTheDocument()
  })
})

describe("GuardianTuitionPayment", () => {
  const pending = {
    student: { name: "Ana", enrollmentNumber: "E1" },
    charges: [
      { id: "c1", amount: 100, status: "PENDING", description: "Mensalidade", dueDate: "2026-02-01" },
      { id: "c2", amount: "50.5", status: "OVERDUE", dueDate: "2026-03-01" },
    ],
  }

  const lookup = () => {
    fireEvent.change(screen.getByPlaceholderText("enrollmentPlaceholderPayment"), { target: { value: " E1 " } })
    fireEvent.submit(screen.getByText("consultCharges").closest("form"))
  }

  const openMock = () => {
    const doc = { write: vi.fn(), close: vi.fn() }
    const win = { document: doc, opener: {} }
    const open = vi.spyOn(window, "open").mockReturnValue(win)
    return { open, doc, win }
  }

  it("looks up charges and shows totals", async () => {
    apiFetch.mockResolvedValue(pending)
    renderWithRouter(<GuardianTuitionPayment />)
    lookup()
    expect(await screen.findByText("tuitionChargesLoaded")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/finance/tuition/E1/pending")
    expect(screen.getByText("150.50 HTG")).toBeInTheDocument()
    expect(screen.getByText("Mensalidade")).toBeInTheDocument()
    expect(screen.getAllByText("invoiceDefaultItem").length).toBeGreaterThan(0)
    expect(screen.getByText("50.50 HTG - OVERDUE")).toBeInTheDocument()
  })

  it("shows no pending charges and lookup errors", async () => {
    apiFetch.mockResolvedValueOnce({ student: { name: "Ana", enrollmentNumber: "E1" } })
    renderWithRouter(<GuardianTuitionPayment />)
    lookup()
    expect(await screen.findByText("noPendingCharges")).toBeInTheDocument()
    expect(screen.getByText("0.00 HTG")).toBeInTheDocument()

    apiFetch.mockRejectedValueOnce(new Error("unknown student"))
    lookup()
    expect(await screen.findByText("unknown student")).toBeInTheDocument()
    expect(screen.queryByText("noPendingCharges")).toBeNull()

    apiFetch.mockImplementationOnce(() => new Promise(() => {}))
    lookup()
    expect(await screen.findByText("loading")).toBeInTheDocument()
  })

  it("pays tuition with card fields and refreshes the charges", async () => {
    apiFetch.mockResolvedValueOnce(pending)
    renderWithRouter(<GuardianTuitionPayment />)
    lookup()
    await screen.findByText("tuitionChargesLoaded")

    const payButton = screen.getByText("payTuition")
    expect(payButton).toBeDisabled()
    const [provider, charge] = screen.getAllByRole("combobox")
    fireEvent.change(provider, { target: { value: "card" } })
    fireEvent.change(screen.getByPlaceholderText("cardNumberPlaceholder"), { target: { value: "4111" } })
    fireEvent.change(screen.getByPlaceholderText("cardExpiryPlaceholder"), { target: { value: "12/30" } })
    fireEvent.change(screen.getByPlaceholderText("cardCvvPlaceholder"), { target: { value: "123" } })
    fireEvent.change(screen.getByPlaceholderText("accountNumberPlaceholder"), { target: { value: "ACC" } })
    fireEvent.change(screen.getByPlaceholderText("amountPlaceholder"), { target: { value: "100" } })
    fireEvent.change(charge, { target: { value: "c1" } })
    fireEvent.change(screen.getByPlaceholderText("guardianNamePlaceholderPayment"), { target: { value: "Marie" } })
    fireEvent.change(screen.getByPlaceholderText("guardianPhonePlaceholderPayment"), { target: { value: "509" } })
    fireEvent.click(screen.getByRole("checkbox"))
    expect(payButton).toBeEnabled()

    apiFetch.mockResolvedValueOnce({ receiptNumber: "R1" }).mockResolvedValueOnce({ student: pending.student })
    fireEvent.submit(payButton.closest("form"))
    expect(await screen.findByText("paymentConfirmedReceipt")).toBeInTheDocument()
    const body = apiFetch.mock.calls.find((c) => c[0] === "/finance/tuition/pay")[1].body
    expect(body).toMatchObject({
      provider: "card",
      accountNumber: "ACC",
      studentEnrollmentNumber: "E1",
      amountHtg: 100,
      tuitionPaymentId: "c1",
      guardianName: "Marie",
      guardianPhone: "509",
    })
    expect(body.idempotencyKey).toBeTruthy()
    expect(await screen.findByText("noPendingCharges")).toBeInTheDocument()
    expect(screen.getByRole("checkbox")).not.toBeChecked()
  })

  it("uses a fallback idempotency key, omits optional fields and reports payment errors", async () => {
    const original = globalThis.crypto
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true })
    try {
      renderWithRouter(<GuardianTuitionPayment />)
      fireEvent.change(screen.getByPlaceholderText("enrollmentPlaceholderPayment"), { target: { value: "E1" } })
      fireEvent.click(screen.getByRole("checkbox"))
      apiFetch.mockRejectedValueOnce(new Error("payment declined"))
      fireEvent.submit(screen.getByText("payTuition").closest("form"))
      expect(await screen.findByText("payment declined")).toBeInTheDocument()
      const body = apiFetch.mock.calls[0][1].body
      expect(body.idempotencyKey).toMatch(/^pay-/)
      expect(body.tuitionPaymentId).toBeUndefined()
      expect(body.guardianName).toBeUndefined()
      expect(body.guardianPhone).toBeUndefined()

      apiFetch.mockImplementationOnce(() => new Promise(() => {}))
      fireEvent.submit(screen.getByText("payTuition").closest("form"))
      expect(await screen.findByText("processingPayment")).toBeInTheDocument()
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: original, configurable: true })
    }
  })

  it("generates an escaped invoice from the charges", async () => {
    apiFetch.mockResolvedValue({ ...pending, student: { name: "Ana", enrollmentNumber: "<E1>" } })
    renderWithRouter(<GuardianTuitionPayment />)
    lookup()
    await screen.findByText("tuitionChargesLoaded")
    const { open, doc, win } = openMock()
    fireEvent.click(screen.getByText("generateInvoiceReceipt"))
    expect(open).toHaveBeenCalledWith("", "_blank")
    expect(win.opener).toBeNull()
    const html = doc.write.mock.calls[0][0]
    expect(html).toContain("&lt;E1&gt;")
    expect(html).toContain("<td>Mensalidade</td><td>100.00 HTG</td>")
    expect(html).toContain("<td>invoiceDefaultItem</td><td>50.50 HTG</td>")
    expect(html).toContain("<strong>150.50 HTG</strong>")
    expect(doc.close).toHaveBeenCalled()
    open.mockRestore()
  })

  it("generates a default invoice without a student and handles blocked popups", async () => {
    renderWithRouter(<GuardianTuitionPayment />)
    const { open, doc } = openMock()
    fireEvent.click(screen.getByText("generateInvoiceReceipt"))
    let html = doc.write.mock.calls[0][0]
    expect(html).toContain("studentLabel: -")
    expect(html).toContain("enrollmentLabel: -")
    expect(html).toContain("<td>invoiceDefaultItem</td><td>0.00 HTG</td>")

    fireEvent.change(screen.getByPlaceholderText("amountPlaceholder"), { target: { value: "25" } })
    fireEvent.click(screen.getByText("generateInvoiceReceipt"))
    html = doc.write.mock.calls[1][0]
    expect(html).toContain("<strong>25.00 HTG</strong>")

    open.mockReturnValue(null)
    fireEvent.click(screen.getByText("generateInvoiceReceipt"))
    expect(await screen.findByText("popupBlocked")).toBeInTheDocument()
    open.mockRestore()
  })

  it("escapes quotes and ampersands in invoice items", async () => {
    apiFetch.mockResolvedValue({ student: null, charges: [{ id: "x", amount: 1, status: "P", description: `A&B "q" 'z'` }] })
    renderWithRouter(<GuardianTuitionPayment />)
    lookup()
    await screen.findByText("tuitionChargesLoaded")
    const { open, doc } = openMock()
    fireEvent.click(screen.getByText("generateInvoiceReceipt"))
    await waitFor(() => expect(doc.write).toHaveBeenCalled())
    expect(doc.write.mock.calls[0][0]).toContain("A&amp;B &quot;q&quot; &#39;z&#39;")
    open.mockRestore()
  })
})
