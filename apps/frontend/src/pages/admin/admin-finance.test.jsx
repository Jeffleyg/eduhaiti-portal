import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../../test/utils.jsx"

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: "tok" }) }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn(), apiFetchRaw: vi.fn() }))

import { apiFetch, apiFetchRaw } from "../../lib/api.js"
import AdminFinanceControl from "./AdminFinanceControl.jsx"
import FinancePaymentHistory from "./components/FinancePaymentHistory.jsx"
import FinanceFiltersAndSummary from "./components/FinanceFiltersAndSummary.jsx"
import FinanceChargeForm from "./components/FinanceChargeForm.jsx"
import FinanceInstallmentForm from "./components/FinanceInstallmentForm.jsx"

const payment = (over = {}) => ({
  id: "p1",
  amount: 100,
  status: "PAID",
  dueDate: "2026-01-01",
  paidDate: "2026-01-02",
  student: { name: "Ana", email: "a@x", enrollmentNumber: "E1" },
  ...over,
})

beforeEach(() => {
  apiFetch.mockReset()
  apiFetchRaw.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe("AdminFinanceControl", () => {
  it("switches sections", async () => {
    renderWithRouter(<AdminFinanceControl />)
    expect(screen.getByText("newTuitionCharge")).toBeInTheDocument()
    await userEvent.click(screen.getByText("btnInstallment"))
    expect(screen.getByText("renegotiationInstallmentDesc")).toBeInTheDocument()
    await userEvent.click(screen.getByText("btnHistory"))
    expect(screen.getByText("paymentHistoryDesc")).toBeInTheDocument()
    await userEvent.click(screen.getByText("btnCreateCharge"))
    expect(screen.getByText("createTuitionChargeDesc")).toBeInTheDocument()
  })

  it("loads the dashboard with filters and paginates the history", async () => {
    apiFetch.mockImplementation(async (path) =>
      path.startsWith("/finance/admin/summary")
        ? { totalPayments: 2, totalAmountHtg: 300, byStatus: { PAID: { amountHtg: 100 } } }
        : { rows: [payment()], page: 1, pageSize: 20, total: 40, totalPages: 2 },
    )
    renderWithRouter(<AdminFinanceControl />)
    await userEvent.click(screen.getByText("btnFilters"))
    fireEvent.change(screen.getByPlaceholderText("Filtrar..."), { target: { value: " E1 " } })
    const dates = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dates[0], { target: { value: "2026-01-01" } })
    fireEvent.change(dates[1], { target: { value: "2026-12-31" } })
    await userEvent.click(screen.getByRole("combobox"))
    await userEvent.click(await screen.findByRole("option", { name: "Pago" }))
    await userEvent.click(screen.getByText("loadDashboard"))
    expect(await screen.findByText("dashboardLoaded")).toBeInTheDocument()
    expect(apiFetch.mock.calls[0][0]).toBe(
      "/finance/admin/summary?studentEnrollmentNumber=E1&status=PAID&startDate=2026-01-01&endDate=2026-12-31&page=1&pageSize=20",
    )
    expect(screen.getByText("100.00")).toBeInTheDocument()
    expect(screen.getAllByText("200.00")).toHaveLength(1)

    await userEvent.click(screen.getByText("btnHistory"))
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0)
    apiFetch.mockClear()
    await userEvent.click(screen.getByText(/nextPage/))
    await waitFor(() => expect(apiFetch).toHaveBeenCalled())
    expect(apiFetch.mock.calls[0][0]).toContain("page=2")
  })

  it("handles sparse payment payloads and load errors", async () => {
    apiFetch.mockImplementationOnce(async () => ({})).mockImplementationOnce(async () => ({}))
    renderWithRouter(<AdminFinanceControl />)
    await userEvent.click(screen.getByText("btnFilters"))
    await userEvent.click(screen.getByText("loadDashboard"))
    expect(await screen.findByText("dashboardLoaded")).toBeInTheDocument()
    apiFetch.mockRejectedValue(new Error("finance down"))
    await userEvent.click(screen.getByText("loadDashboard"))
    expect(await screen.findByText("finance down")).toBeInTheDocument()
  })

  it("exports the CSV and reports export errors", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const createObjectURL = vi.fn(() => "blob:x")
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    apiFetchRaw.mockResolvedValueOnce({ text: async () => "a,b\n1,2" })
    renderWithRouter(<AdminFinanceControl />)
    await userEvent.click(screen.getByText("btnFilters"))
    await userEvent.click(screen.getByText("exportCsv"))
    expect(await screen.findByText("csvExported")).toBeInTheDocument()
    expect(apiFetchRaw.mock.calls[0][0]).toBe("/finance/admin/payments/export?")
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:x")
    act(() => vi.advanceTimersByTime(3100))
    await waitFor(() => expect(screen.queryByText("csvExported")).toBeNull())

    apiFetchRaw.mockRejectedValueOnce(new Error("export failed"))
    await userEvent.click(screen.getByText("exportCsv"))
    expect(await screen.findByText("export failed")).toBeInTheDocument()
  })

  it("reloads after creating a charge or an installment plan", async () => {
    apiFetch.mockImplementation(async (path) => {
      if (path === "/finance/admin/tuition-charges") return {}
      if (path === "/finance/admin/installment-plans") return { planId: "P1", installments: [1, 2] }
      return { rows: [] }
    })
    renderWithRouter(<AdminFinanceControl />)
    fireEvent.submit(screen.getByText("createCharge").closest("form"))
    await waitFor(() => expect(apiFetch.mock.calls.some((c) => c[0].startsWith("/finance/admin/summary"))).toBe(true))
    apiFetch.mockClear()
    await userEvent.click(screen.getByText("btnInstallment"))
    fireEvent.submit(screen.getByText("generateInstallment").closest("form"))
    await waitFor(() => expect(apiFetch.mock.calls.some((c) => c[0].startsWith("/finance/admin/payments"))).toBe(true))
  })
})

describe("FinancePaymentHistory", () => {
  it("renders statuses and fallbacks", () => {
    render(
      <FinancePaymentHistory
        payments={[
          payment({ id: "1", status: "PENDING", paidDate: null, student: null }),
          payment({ id: "2", status: "PARTIAL" }),
          payment({ id: "3", status: "PAID" }),
          payment({ id: "4", status: "OVERDUE" }),
          payment({ id: "5", status: "WEIRD" }),
        ]}
        pagination={{ page: 1, totalPages: 1 }}
      />,
    )
    for (const key of ["paymentStatusPending", "paymentStatusPartial", "paymentStatusPaid"]) {
      expect(screen.getByText(key)).toBeInTheDocument()
    }
    expect(screen.getAllByText("paymentStatusOverdue")).toHaveLength(2)
    expect(screen.getAllByText("—").length).toBeGreaterThan(1)
  })

  it("pages through results", async () => {
    const onPageChange = vi.fn()
    const { rerender } = render(
      <FinancePaymentHistory payments={null} loading pagination={{ page: 2, totalPages: 3 }} onPageChange={onPageChange} />,
    )
    expect(screen.getByText(/previousPage/).closest("button")).toBeDisabled()
    rerender(<FinancePaymentHistory payments={[]} pagination={{ page: 2, totalPages: 3 }} onPageChange={onPageChange} />)
    await userEvent.click(screen.getByText(/previousPage/))
    await userEvent.click(screen.getByText(/nextPage/))
    expect(onPageChange.mock.calls).toEqual([[1], [3]])
    rerender(<FinancePaymentHistory payments={[]} />)
    expect(screen.queryByText(/nextPage/)).toBeNull()
  })
})

describe("FinanceFiltersAndSummary", () => {
  it("computes paid and pending totals from different payload shapes", () => {
    const filters = { studentEnrollmentNumber: "", status: "ALL", startDate: "", endDate: "" }
    const { rerender } = render(
      <FinanceFiltersAndSummary filters={filters} summary={{ totalPayments: 0, totalAmountHtg: 50, paidAmountHtg: 20 }} onFilterChange={vi.fn()} />,
    )
    expect(screen.getByText("30.00")).toBeInTheDocument()
    rerender(<FinanceFiltersAndSummary filters={filters} summary={{}} onFilterChange={vi.fn()} />)
    expect(screen.getAllByText("0.00")).toHaveLength(3)
    rerender(<FinanceFiltersAndSummary filters={filters} summary={null} onFilterChange={vi.fn()} />)
    expect(screen.queryByText("totalCharges")).toBeNull()
  })
})

describe("FinanceChargeForm", () => {
  it("sends every field and resets", async () => {
    const onSuccess = vi.fn()
    apiFetch.mockResolvedValueOnce({})
    const { container } = render(<FinanceChargeForm onSuccess={onSuccess} />)
    const inputs = container.querySelectorAll("input")
    fireEvent.change(inputs[0], { target: { value: "E1" } })
    fireEvent.change(inputs[1], { target: { value: "1500" } })
    fireEvent.change(inputs[2], { target: { value: "2026-12-01" } })
    fireEvent.change(inputs[3], { target: { value: "Oct" } })
    fireEvent.change(inputs[4], { target: { value: "10" } })
    fireEvent.change(inputs[5], { target: { value: "Merit" } })
    fireEvent.click(inputs[6])
    fireEvent.change(inputs[7], { target: { value: "5" } })
    fireEvent.submit(container.querySelector("form"))
    expect(await screen.findByText("createChargeSuccess")).toBeInTheDocument()
    expect(apiFetch.mock.calls[0][1].body).toEqual({
      studentEnrollmentNumber: "E1",
      amountHtg: 1500,
      dueDate: "2026-12-01",
      description: "Oct",
      scholarshipPercent: 10,
      scholarshipLabel: "Merit",
      punctualityDiscountPercent: 5,
      applyPunctualityDiscount: false,
    })
    expect(onSuccess).toHaveBeenCalled()
    expect(inputs[0]).toHaveValue("")
  })

  it("omits optional fields, shows errors and loading", async () => {
    apiFetch.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("bad charge"))
    const { container, rerender } = render(<FinanceChargeForm />)
    fireEvent.submit(container.querySelector("form"))
    await screen.findByText("createChargeSuccess")
    expect(apiFetch.mock.calls[0][1].body).toMatchObject({
      description: undefined,
      scholarshipPercent: undefined,
      punctualityDiscountPercent: undefined,
      applyPunctualityDiscount: true,
    })
    fireEvent.submit(container.querySelector("form"))
    expect(await screen.findAllByText("bad charge")).toHaveLength(1)
    rerender(<FinanceChargeForm loading />)
    expect(screen.getByText("sending")).toBeInTheDocument()
  })
})

describe("FinanceInstallmentForm", () => {
  it("sends every field and resets", async () => {
    const onSuccess = vi.fn()
    apiFetch.mockResolvedValueOnce({ planId: "P9" })
    const { container } = render(<FinanceInstallmentForm onSuccess={onSuccess} />)
    const inputs = container.querySelectorAll("input")
    fireEvent.change(inputs[0], { target: { value: "E1" } })
    fireEvent.change(inputs[1], { target: { value: "4" } })
    fireEvent.change(inputs[2], { target: { value: "2026-12-01" } })
    fireEvent.change(inputs[3], { target: { value: "" } })
    fireEvent.change(inputs[4], { target: { value: "900" } })
    fireEvent.change(inputs[5], { target: { value: "Deal" } })
    fireEvent.click(inputs[6])
    fireEvent.submit(container.querySelector("form"))
    expect(await screen.findByText("installmentCreated")).toBeInTheDocument()
    expect(apiFetch.mock.calls[0][1].body).toEqual({
      studentEnrollmentNumber: "E1",
      installments: 4,
      firstDueDate: "2026-12-01",
      intervalDays: undefined,
      customTotalAmountHtg: 900,
      markSourceAsRenegotiated: false,
      description: "Deal",
    })
    expect(onSuccess).toHaveBeenCalled()
  })

  it("uses defaults, shows errors and loading", async () => {
    apiFetch.mockResolvedValueOnce({ planId: "P1", installments: [1] }).mockRejectedValueOnce(new Error("bad plan"))
    const { container, rerender } = render(<FinanceInstallmentForm />)
    fireEvent.submit(container.querySelector("form"))
    await screen.findByText("installmentCreated")
    expect(apiFetch.mock.calls[0][1].body).toMatchObject({ intervalDays: 30, customTotalAmountHtg: undefined, description: undefined })
    fireEvent.submit(container.querySelector("form"))
    expect(await screen.findAllByText("bad plan")).toHaveLength(1)
    rerender(<FinanceInstallmentForm loading />)
    expect(screen.getByText("sending")).toBeInTheDocument()
  })
})
