import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../../test/utils.jsx"

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: "tok", user: { role: "OWNER" } }) }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../../lib/api.js"
import { SurvivalModeNetworkError } from "../../lib/network-interceptor.js"
import OwnerDashboard from "./OwnerDashboard.jsx"
import SchoolAnalytics from "./components/SchoolAnalytics.jsx"
import SchoolFeatures from "./components/SchoolFeatures.jsx"
import PermissionCodeManager from "./components/PermissionCodeManager.jsx"
import SchoolForm from "./components/SchoolForm.jsx"
import SchoolsList from "./components/SchoolsList.jsx"

const school = {
  id: "s1",
  name: "Lycée",
  email: "l@x.ht",
  city: "Cap",
  country: "Haiti",
  enableFinance: true,
  enableFamilyAccess: false,
  enablePayment: true,
  usageAnalytics: { totalUsers: 3, classCount: 2, attendanceRecords: 9 },
}
const analytics = {
  totalSchools: 1,
  totalUsers: 3,
  totalLogins: 7,
  totalGrades: 4,
  totalAttendance: 9,
  schoolsDetails: [
    { id: "s1", name: "Lycée", logins: 7, users: 3, students: 2, teachers: 1, classes: 2, lastActivity: "2026-01-01" },
    { id: "s2", name: "Other", logins: 0, users: 0, students: 0, teachers: 0, classes: 0 },
  ],
}

beforeEach(() => {
  apiFetch.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe("OwnerDashboard", () => {
  const api = (overrides = {}) =>
    apiFetch.mockImplementation(async (path, options = {}) => {
      const key = `${options.method ?? "GET"} ${path}`
      if (key in overrides) {
        const v = overrides[key]
        if (v instanceof Error) throw v
        return typeof v === "function" ? v(options) : v
      }
      if (path === "/owner/schools") return [school]
      if (path === "/owner/analytics/summary") return analytics
      if (path.endsWith("/features")) return { enableFinance: true }
      if (path.endsWith("/permission-codes")) return []
      return {}
    })

  it("shows stats, analytics and switches tabs", async () => {
    api()
    renderWithRouter(<OwnerDashboard />)
    expect(await screen.findByText("Lycée")).toBeInTheDocument()
    expect(screen.getByText("7")).toBeInTheDocument()
    await userEvent.click(screen.getByText("usageAnalysis"))
    expect(screen.getByText("Uso por Escola")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /^schools \(/ }))
    expect(screen.getByText("Lycée")).toBeInTheDocument()
  })

  it("creates a school and shows the success message", async () => {
    api({ "POST /owner/schools": { school: { name: "Nova" } } })
    renderWithRouter(<OwnerDashboard />)
    await screen.findByText("Lycée")
    await userEvent.click(screen.getByText("+ newSchool"))
    expect(screen.getByText("createNewSchool")).toBeInTheDocument()
    await userEvent.click(screen.getAllByText("cancel")[0])
    expect(screen.queryByText("createNewSchool")).toBeNull()

    await userEvent.click(screen.getByText("+ newSchool"))
    fireEvent.change(screen.getByPlaceholderText("Ex: EduHaiti Academy"), { target: { value: "Nova" } })
    fireEvent.change(screen.getByPlaceholderText("contact@ecole.ht"), { target: { value: "n@x.ht" } })
    fireEvent.change(screen.getByPlaceholderText("Ex: Jean-Pierre Dessalines"), { target: { value: "Dir" } })
    fireEvent.change(screen.getByPlaceholderText("Nome do Administrador"), { target: { value: "Adm" } })
    fireEvent.change(screen.getByPlaceholderText("admin@ecole.ht"), { target: { value: "a@x.ht" } })
    fireEvent.submit(screen.getByText("Cadastrar Escola & Admin").closest("form"))
    expect(await screen.findByText("schoolCreatedSuccess: Nova")).toBeInTheDocument()
    await userEvent.click(screen.getByText("✕"))
    expect(screen.queryByText("schoolCreatedSuccess: Nova")).toBeNull()
  })

  it("shows an unsent admin password once and default names after creation and edits", async () => {
    let created = 0
    api({
      "POST /owner/schools": () =>
        created++ === 0 ? { adminAccount: { email: "a@x", emailSent: false, tempPassword: "Tmp12345" } } : null,
      "PATCH /owner/schools/s1": { school: null },
    })
    renderWithRouter(<OwnerDashboard />)
    await screen.findByText("Lycée")
    await userEvent.click(screen.getByText("+ newSchool"))
    fireEvent.submit(screen.getByText("Cadastrar Escola & Admin").closest("form"))
    expect(await screen.findByTestId("temp-password")).toHaveTextContent("Tmp12345")
    expect(screen.getByText("tempPasswordNotEmailed")).toBeInTheDocument()
    expect(screen.getByText("schoolCreatedSuccess: newSchool")).toBeInTheDocument()

    await userEvent.click(screen.getByText("editAction"))
    expect(screen.getByText("editSchool")).toBeInTheDocument()
    fireEvent.submit(screen.getByText("save").closest("form"))
    expect(await screen.findByText("schoolUpdatedSuccess: Lycée")).toBeInTheDocument()
    expect(screen.queryByTestId("temp-password")).toBeNull()
  })

  it("deletes a school after confirmation and handles errors", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true)
    api({ "DELETE /owner/schools/s1": {} })
    renderWithRouter(<OwnerDashboard />)
    await screen.findByText("Lycée")
    await userEvent.click(screen.getByText("deleteAction"))
    expect(apiFetch).not.toHaveBeenCalledWith("/owner/schools/s1", expect.anything())

    vi.useFakeTimers({ shouldAdvanceTime: true })
    await userEvent.click(screen.getByText("deleteAction"))
    expect(await screen.findByText("schoolDeletedSuccess")).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(3100))
    await waitFor(() => expect(screen.queryByText("schoolDeletedSuccess")).toBeNull())

    apiFetch.mockRejectedValueOnce(new Error("cannot delete"))
    await userEvent.click(screen.getByText("deleteAction"))
    expect(await screen.findByText("cannot delete")).toBeInTheDocument()
  })

  it("reports load errors and survival-mode blocking", async () => {
    api({
      "GET /owner/schools": new Error("schools down"),
      "GET /owner/analytics/summary": new SurvivalModeNetworkError("/owner/analytics/summary"),
    })
    renderWithRouter(<OwnerDashboard />)
    expect(await screen.findByText("schools down")).toBeInTheDocument()
    await userEvent.click(screen.getByText("usageAnalysis"))
    expect(screen.getByText("Análise de uso bloqueada para economizar dados")).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText("Descartar"))
    expect(document.querySelector(".skeleton-card")).not.toBeNull()
  })

  it("reports analytics errors and empty school lists", async () => {
    api({ "GET /owner/analytics/summary": new Error("analytics down"), "GET /owner/schools": null })
    renderWithRouter(<OwnerDashboard />)
    expect(await screen.findByText("analytics down")).toBeInTheDocument()
    expect(screen.getByText("noSchoolsRegistered")).toBeInTheDocument()
  })

  it("closes the edit form from the cancel buttons", async () => {
    api()
    renderWithRouter(<OwnerDashboard />)
    await screen.findByText("Lycée")
    await userEvent.click(screen.getByText("editAction"))
    expect(screen.getByText("editSchool")).toBeInTheDocument()
    // the top button switches from editing to a fresh "create" form
    await userEvent.click(screen.getAllByText("cancel")[0])
    expect(screen.getByText("createNewSchool")).toBeInTheDocument()
    await userEvent.click(screen.getAllByText("cancel")[1])
    expect(screen.queryByText("createNewSchool")).toBeNull()
  })
})

describe("SchoolsList", () => {
  it("shows loading, details, features and permission codes", async () => {
    apiFetch.mockImplementation(async (path) => (path.endsWith("/features") ? {} : []))
    const { rerender } = render(<SchoolsList schools={[]} loading token="t" />)
    expect(screen.getByText("loadingSchools")).toBeInTheDocument()
    rerender(
      <SchoolsList
        schools={[school, { id: "s2", name: "B", country: "HT", enableFamilyAccess: true }]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        token="t"
      />,
    )
    expect(screen.getByText("Finanças: Ativo")).toBeInTheDocument()
    expect(screen.getByText("Família: Ativo")).toBeInTheDocument()
    await userEvent.click(screen.getAllByText("details")[0])
    expect(await screen.findByText("Controle de Módulos da Escola")).toBeInTheDocument()
    await userEvent.click(screen.getByText("collapse"))
    expect(screen.queryByText("Controle de Módulos da Escola")).toBeNull()
  })
})

describe("SchoolAnalytics", () => {
  it("renders skeletons without data and the usage table", () => {
    const { container, rerender } = render(<SchoolAnalytics analytics={null} />)
    expect(container.querySelector(".skeleton-card")).not.toBeNull()
    rerender(<SchoolAnalytics analytics={analytics} />)
    expect(screen.getByText("Other")).toBeInTheDocument()
    rerender(<SchoolAnalytics analytics={{ ...analytics, schoolsDetails: undefined }} />)
    expect(screen.getByText("Sem dados de uso por escola ainda.")).toBeInTheDocument()
  })
})

describe("SchoolFeatures", () => {
  it("toggles modules and reports errors", async () => {
    apiFetch
      .mockResolvedValueOnce({ enableFinance: true })
      .mockResolvedValueOnce({ enableFinance: false, enableSync: true })
      .mockRejectedValueOnce(new Error(""))
    render(<SchoolFeatures schoolId="s1" token="t" />)
    expect(screen.getByText("Carregando permissões dos módulos...")).toBeInTheDocument()
    const finance = (await screen.findByText("Módulo Financeiro")).closest("div.p-3\\.5")
    await userEvent.click(within(finance).getByText("Ativo"))
    expect(apiFetch).toHaveBeenLastCalledWith("/owner/schools/s1/features", {
      method: "PATCH",
      token: "t",
      body: { enableFinance: false },
    })
    expect(within(finance).getByText("Inativo")).toBeInTheDocument()
    await userEvent.click(within(finance).getByText("Inativo"))
    expect(await screen.findByText("Falha ao atualizar módulo.")).toBeInTheDocument()
  })

  it("shows load errors and accepts empty payloads", async () => {
    apiFetch.mockRejectedValueOnce(new Error("load failed"))
    const { unmount } = render(<SchoolFeatures schoolId="s1" token="t" />)
    expect(await screen.findByText("load failed")).toBeInTheDocument()
    unmount()
    apiFetch.mockResolvedValueOnce(null)
    render(<SchoolFeatures schoolId="s1" token="t" />)
    expect(await screen.findAllByText("Inativo")).toHaveLength(6)
  })

  it("shows a saving indicator", async () => {
    let finish
    apiFetch.mockResolvedValueOnce({}).mockImplementationOnce(() => new Promise((r) => (finish = r)))
    render(<SchoolFeatures schoolId="s1" token="t" />)
    await userEvent.click((await screen.findAllByText("Inativo"))[0])
    expect(screen.getByText("...")).toBeInTheDocument()
    await act(async () => finish({ enableFinance: true }))
  })
})

describe("PermissionCodeManager", () => {
  it("generates, lists and revokes codes", async () => {
    apiFetch
      .mockResolvedValueOnce([{ id: "1", code: "ABCD", name: "Admins", usedAt: "x", usedBy: "a@x" }])
      .mockResolvedValueOnce({ id: "2", code: "EFGH" })
      .mockResolvedValueOnce({})
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<PermissionCodeManager schoolId="s1" token="t" />)
    expect(await screen.findByText("ABCD")).toBeInTheDocument()
    expect(screen.getByText("Usado por: a@x")).toBeInTheDocument()

    await userEvent.click(screen.getByText("+ Gerar Código"))
    fireEvent.change(screen.getByPlaceholderText("Nome (opcional)"), { target: { value: "Diretor" } })
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "90" } })
    await userEvent.click(screen.getByText("Gerar"))
    expect(await screen.findByText("EFGH")).toBeInTheDocument()
    expect(apiFetch.mock.calls[1][1].body).toEqual({ name: "Diretor", expiresIn: 90 })

    await userEvent.click(screen.getAllByText("Revogar")[0])
    expect(screen.getByText("ABCD")).toBeInTheDocument()
    await userEvent.click(screen.getAllByText("Revogar")[0])
    await waitFor(() => expect(screen.queryByText("ABCD")).toBeNull())

    await userEvent.click(screen.getByText("+ Gerar Código"))
    await userEvent.click(screen.getByText("Cancelar"))
    expect(screen.queryByPlaceholderText("Nome (opcional)")).toBeNull()
  })

  it("shows errors from every action", async () => {
    apiFetch.mockRejectedValueOnce(new Error("load error"))
    const { unmount } = render(<PermissionCodeManager schoolId="s1" token="t" />)
    expect(await screen.findByText("load error")).toBeInTheDocument()
    expect(screen.getByText("Nenhum código gerado")).toBeInTheDocument()
    unmount()

    apiFetch
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("generate error"))
    render(<PermissionCodeManager schoolId="s2" token="t" />)
    await userEvent.click(await screen.findByText("+ Gerar Código"))
    await userEvent.click(screen.getByText("Gerar"))
    expect(await screen.findByText("generate error")).toBeInTheDocument()
  })

  it("reports revoke failures", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    apiFetch.mockResolvedValueOnce([{ id: "1", code: "X1" }]).mockRejectedValueOnce(new Error("revoke error"))
    render(<PermissionCodeManager schoolId="s1" token="t" />)
    await userEvent.click(await screen.findByText("Revogar"))
    expect(await screen.findByText("revoke error")).toBeInTheDocument()
  })
})

describe("SchoolForm", () => {
  it("edits an existing school with defaults and toggles modules", async () => {
    const onSuccess = vi.fn()
    apiFetch.mockResolvedValueOnce({ school: { id: "s1", name: "Server" } })
    render(<SchoolForm school={{ id: "s1" }} onSuccess={onSuccess} onCancel={vi.fn()} token="t" />)
    expect(screen.getByPlaceholderText("Port-au-Prince")).toHaveValue("Port-au-Prince")
    expect(screen.queryByPlaceholderText("admin@ecole.ht")).toBeNull()
    const checkboxes = screen.getAllByRole("checkbox")
    for (const box of checkboxes) await userEvent.click(box)
    fireEvent.change(screen.getByPlaceholderText("+509 3700-0000"), { target: { value: " 509 " } })
    fireEvent.change(screen.getByPlaceholderText("Rue Capois, Champ de Mars"), { target: { value: " Rue " } })
    fireEvent.change(screen.getByPlaceholderText("Port-au-Prince"), { target: { value: " " } })
    fireEvent.submit(screen.getByText("save").closest("form"))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ school: { id: "s1", name: "Server" } }))
    expect(apiFetch.mock.calls[0][1].body).toMatchObject({
      phone: "509",
      address: "Rue",
      city: "Port-au-Prince",
      enableFinance: false,
      enableFamilyAccess: false,
      enablePayment: false,
      enableSync: false,
    })
    expect(apiFetch.mock.calls[0][1].body).not.toHaveProperty("adminEmail")
  })

  it("prefills existing values and switches back to create mode", () => {
    const full = {
      id: "s1",
      name: "N",
      email: "e",
      phone: "p",
      address: "a",
      city: "c",
      country: "co",
      principal: "pr",
      enableFinance: false,
      enableFamilyAccess: false,
      enablePayment: false,
      enableSync: false,
      enableLessons: false,
    }
    const { rerender } = render(<SchoolForm school={full} token="t" />)
    expect(screen.getByPlaceholderText("Ex: Jean-Pierre Dessalines")).toHaveValue("pr")
    rerender(<SchoolForm school={null} token="t" />)
    expect(screen.getByPlaceholderText("Ex: EduHaiti Academy")).toHaveValue("")
    // No shared default password: the server generates one per admin.
    expect(screen.queryByDisplayValue("Password@123")).toBeNull()
    expect(screen.getByText(/senha provisória será gerada/)).toBeInTheDocument()
  })

  it("creates a school with admin data and shows errors", async () => {
    const onSuccess = vi.fn()
    apiFetch.mockResolvedValueOnce({ id: "new" }).mockRejectedValueOnce(new Error("")).mockResolvedValueOnce(null)
    render(<SchoolForm onSuccess={onSuccess} token="t" />)
    fireEvent.change(screen.getByPlaceholderText("Nome do Administrador"), { target: { value: " Adm " } })
    fireEvent.submit(screen.getByText("Cadastrar Escola & Admin").closest("form"))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ school: { id: "new" }, adminAccount: null }))
    expect(apiFetch.mock.calls[0][1].body).toMatchObject({ adminName: "Adm" })
    expect(apiFetch.mock.calls[0][1].body).not.toHaveProperty("adminPassword")

    fireEvent.submit(screen.getByText("Cadastrar Escola & Admin").closest("form"))
    expect(await screen.findByText("Falha ao salvar escola.")).toBeInTheDocument()

    render(<SchoolForm school={{ id: "s9", name: "Keep" }} token="t" />)
    fireEvent.submit(screen.getByText("save").closest("form"))
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3))
  })

  it("shows a saving label", async () => {
    apiFetch.mockImplementation(() => new Promise(() => {}))
    render(<SchoolForm token="t" />)
    fireEvent.submit(screen.getByText("Cadastrar Escola & Admin").closest("form"))
    expect(await screen.findByText("saving")).toBeInTheDocument()
  })
})
