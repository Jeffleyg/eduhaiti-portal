import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../../test/utils.jsx"

const auth = { token: "tok", user: { schoolId: "sch1" } }
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => auth }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

// Sub-forms have their own tests; here they only expose their callbacks.
vi.mock("../../components/admin/PeriodForm.jsx", () => ({
  default: ({ periodForm, setPeriodForm, createPeriod, loading }) => (
    <form onSubmit={createPeriod}>
      <input aria-label="period-name" value={periodForm.name} onChange={(e) => setPeriodForm((p) => ({ ...p, name: e.target.value }))} />
      <button type="submit">{loading ? "period-loading" : "create-period"}</button>
    </form>
  ),
}))
vi.mock("../../components/admin/PeriodsList.jsx", () => ({
  default: ({ periods, togglePeriod, removePeriod }) => (
    <ul>
      {periods.map((p) => (
        <li key={p.id}>
          {p.name}
          <button onClick={() => togglePeriod(p)}>toggle-{p.id}</button>
          <button onClick={() => removePeriod(p.id)}>remove-{p.id}</button>
        </li>
      ))}
    </ul>
  ),
}))
vi.mock("../../components/admin/SettingsForm.jsx", () => ({
  default: ({ settingsForm, saveSettings }) => (
    <form onSubmit={saveSettings}>
      <span>pass:{settingsForm.passAverage}|abs:{settingsForm.maxAbsencesPerCourse}|late:{settingsForm.assignmentLateDaysLimit}|review:{settingsForm.gradeReviewWindowDays}</span>
      <button type="submit">save-settings</button>
    </form>
  ),
}))
vi.mock("../../components/admin/SchoolContext.jsx", () => ({
  default: ({ schoolId, setSchoolId, loadPeriods, loadSettings }) => (
    <div>
      <input aria-label="school-id" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} />
      <button onClick={loadPeriods}>reload-periods</button>
      <button onClick={loadSettings}>reload-settings</button>
    </div>
  ),
}))

import { apiFetch } from "../../lib/api.js"
import AdminClassManagement from "./AdminClassManagement.jsx"
import AdminAcademicConfig from "./AdminAcademicConfig.jsx"

let confirmSpy
beforeEach(() => {
  apiFetch.mockReset()
  auth.token = "tok"
  auth.user = { schoolId: "sch1" }
  confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("AdminClassManagement", () => {
  const years = [{ id: "y1", year: "2025" }, { id: "y2", year: "2026", isActive: true }]
  const series = [{ id: "s1", name: "NS1", academicYearId: "y2" }, { id: "s2", name: "NS2", academicYearId: "y1" }]
  const teachers = [{ id: "t1", name: "Jean", email: "jean@x" }, { id: "t2", name: "Paul" }]
  const classes = [
    { id: "c1", name: "3e A", level: "NS1", series: { name: "NS1" }, academicYear: { year: "2026" }, teacher: { id: "t1", name: "Jean" }, students: [{}, {}], maxStudents: 25 },
    { id: "c2", name: "4e B" },
  ]
  const routes = (overrides = {}) =>
    apiFetch.mockImplementation(async (path, options = {}) => {
      const key = `${options.method ?? "GET"} ${path}`
      if (key in overrides) {
        const v = overrides[key]
        if (v instanceof Error) throw v
        return v
      }
      if (path === "/admin/classes/meta/academic-years") return years
      if (path === "/admin/classes/meta/series") return series
      if (path === "/admin/users/teachers") return teachers
      if (path.startsWith("/admin/classes?")) return classes
      return {}
    })

  it("loads the active year and its classes, and filters series by year", async () => {
    routes()
    renderWithRouter(<AdminClassManagement />)
    expect(await screen.findByText("3e A")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/classes?academicYearId=y2", { token: "tok" })
    expect(screen.getByText("NS1 • NS1 • 2026")).toBeInTheDocument()
    expect(screen.getByText("adminClassLevel")).toBeInTheDocument()
    expect(screen.getByText("2/25")).toBeInTheDocument()
    expect(screen.getByText("0/")).toBeInTheDocument()
    expect(screen.getAllByText("adminNoTeacher").length).toBeGreaterThan(1)
    expect(screen.getByText("Jean — jean@x")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Paul" })).toBeInTheDocument()

    const [yearSelect, seriesSelect] = screen.getAllByRole("combobox")
    expect(seriesSelect.querySelectorAll("option")).toHaveLength(2)
    fireEvent.change(seriesSelect, { target: { value: "s1" } })
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/admin/classes?academicYearId=y2&seriesId=s1", { token: "tok" }))

    fireEvent.change(yearSelect, { target: { value: "" } })
    await waitFor(() => expect(screen.getByText("noData")).toBeInTheDocument())
    expect(seriesSelect.querySelectorAll("option")).toHaveLength(3)
  })

  it("requires year and series to create, then creates a class", async () => {
    routes()
    renderWithRouter(<AdminClassManagement />)
    await screen.findByText("3e A")
    fireEvent.change(screen.getByPlaceholderText("adminClassName"), { target: { value: "5e" } })
    fireEvent.submit(screen.getByText("adminCreate").closest("form"))
    expect(await screen.findByText("adminClassYearSeriesRequired")).toBeInTheDocument()

    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "s1" } })
    fireEvent.change(screen.getByPlaceholderText("adminClassLevel"), { target: { value: "NS1" } })
    fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "t1" } })
    fireEvent.change(screen.getByPlaceholderText("adminMaxStudents"), { target: { value: "40" } })
    fireEvent.submit(screen.getByText("adminCreate").closest("form"))
    expect(await screen.findByText("adminClassCreated")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/classes", {
      method: "POST",
      token: "tok",
      body: { name: "5e", level: "NS1", academicYearId: "y2", seriesId: "s1", teacherId: "t1", maxStudents: 40 },
    })

    fireEvent.change(screen.getByPlaceholderText("adminClassName"), { target: { value: "6e" } })
    fireEvent.submit(screen.getByText("adminCreate").closest("form"))
    await screen.findByText("adminClassCreated")
    expect(apiFetch.mock.calls.filter((c) => c[1]?.method === "POST")[1][1].body).toMatchObject({ level: undefined, teacherId: undefined, maxStudents: 30 })
  })

  it("edits, cancels and updates classes and reports errors", async () => {
    routes()
    renderWithRouter(<AdminClassManagement />)
    await screen.findByText("3e A")
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "s1" } })

    await userEvent.click(screen.getAllByTitle("edit")[1])
    expect(screen.getByText("adminEditClass")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("adminClassName")).toHaveValue("4e B")
    expect(screen.getByPlaceholderText("adminMaxStudents")).toHaveValue(30)
    fireEvent.submit(screen.getByText("adminUpdate").closest("form"))
    expect(await screen.findByText("adminClassUpdated")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/classes/c2", { method: "PUT", token: "tok", body: { name: "4e B", teacherId: null, maxStudents: 30 } })

    await userEvent.click(screen.getAllByTitle("edit")[0])
    expect(screen.getByPlaceholderText("adminClassLevel")).toHaveValue("NS1")
    await userEvent.click(screen.getByText("adminCancel"))
    expect(screen.getByText("adminCreateClass")).toBeInTheDocument()

    await userEvent.click(screen.getAllByTitle("edit")[0])
    apiFetch.mockRejectedValueOnce(new Error("update failed"))
    fireEvent.submit(screen.getByText("adminUpdate").closest("form"))
    expect(await screen.findByText("update failed")).toBeInTheDocument()
  })

  it("deletes classes, resetting the form when the edited one is removed", async () => {
    routes()
    renderWithRouter(<AdminClassManagement />)
    await screen.findByText("3e A")

    confirmSpy.mockReturnValueOnce(false)
    await userEvent.click(screen.getAllByTitle("deleteAction")[0])
    expect(apiFetch).not.toHaveBeenCalledWith("/admin/classes/c1", expect.anything())

    await userEvent.click(screen.getAllByTitle("edit")[0])
    await userEvent.click(screen.getAllByTitle("deleteAction")[0])
    expect(await screen.findByText("adminClassDeleted")).toBeInTheDocument()
    expect(screen.getByText("adminCreateClass")).toBeInTheDocument()

    await userEvent.click(screen.getAllByTitle("edit")[1])
    await userEvent.click(screen.getAllByTitle("deleteAction")[0])
    await screen.findByText("adminClassDeleted")
    expect(screen.getByText("adminEditClass")).toBeInTheDocument()

    apiFetch.mockRejectedValueOnce(new Error("delete failed"))
    await userEvent.click(screen.getAllByTitle("deleteAction")[0])
    expect(await screen.findByText("delete failed")).toBeInTheDocument()
  })

  it("falls back to the first year, handles empty and failed loads and no token", async () => {
    routes({ "GET /admin/classes/meta/academic-years": [{ id: "y1", year: "2025" }], "GET /admin/classes?academicYearId=y1": null })
    const first = renderWithRouter(<AdminClassManagement />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/admin/classes?academicYearId=y1", { token: "tok" }))
    expect(await screen.findByText("noData")).toBeInTheDocument()
    first.unmount()

    routes({ "GET /admin/classes/meta/academic-years": null, "GET /admin/classes/meta/series": null, "GET /admin/users/teachers": null })
    const second = renderWithRouter(<AdminClassManagement />)
    expect(await screen.findByText("noData")).toBeInTheDocument()
    expect(screen.getAllByRole("option")).toHaveLength(3)
    second.unmount()

    routes({ "GET /admin/classes/meta/academic-years": new Error("meta failed") })
    const third = renderWithRouter(<AdminClassManagement />)
    expect(await screen.findByText("meta failed")).toBeInTheDocument()
    third.unmount()

    routes({ "GET /admin/classes?academicYearId=y2": new Error("classes failed") })
    const fourth = renderWithRouter(<AdminClassManagement />)
    expect(await screen.findByText("classes failed")).toBeInTheDocument()
    fourth.unmount()

    apiFetch.mockReset()
    apiFetch.mockImplementation(() => new Promise(() => {}))
    const fifth = renderWithRouter(<AdminClassManagement />)
    expect(screen.getByText("loading")).toBeInTheDocument()
    fifth.unmount()

    apiFetch.mockClear()
    auth.token = null
    renderWithRouter(<AdminClassManagement />)
    expect(apiFetch).not.toHaveBeenCalled()
  })
})

describe("AdminAcademicConfig", () => {
  const routes = (overrides = {}) =>
    apiFetch.mockImplementation(async (path, options = {}) => {
      const key = `${options.method ?? "GET"} ${path}`
      if (key in overrides) {
        const v = overrides[key]
        if (v instanceof Error) throw v
        return v
      }
      if (path === "/admin/academic-years") return [{ id: "y1", year: "2025-2026", isActive: true }, { id: "y2", name: "Legacy" }]
      if (path === "/admin/series") return [{ id: "s1", name: "NS1", code: "N1" }, { id: "s2", name: "Philo" }]
      if (path === "/admin/academic-periods") return [{ id: "p1", name: "T1", isOpen: true }, { id: "p2", name: "T2", isOpen: false }]
      if (path === "/admin/academic-settings/sch1") return { passAverage: 12, maxAbsencesPerCourse: 3 }
      return {}
    })

  it("lists, creates and deletes academic years", async () => {
    routes()
    renderWithRouter(<AdminAcademicConfig />)
    expect(await screen.findByText("2025-2026")).toBeInTheDocument()
    expect(screen.getByText("Legacy")).toBeInTheDocument()
    expect(screen.getByText("active")).toBeInTheDocument()

    const [yearInput, start, end] = document.querySelectorAll("form input")
    fireEvent.change(yearInput, { target: { value: " 2027-2028 " } })
    fireEvent.change(start, { target: { value: "2027-09-01" } })
    fireEvent.change(end, { target: { value: "2028-06-30" } })
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.submit(yearInput.closest("form"))
    expect(await screen.findByText("academicYearSaved")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/academic-years", {
      method: "POST",
      token: "tok",
      body: { year: "2027-2028", startDate: "2027-09-01", endDate: "2028-06-30", isActive: false },
    })
    expect(yearInput).toHaveValue("")

    fireEvent.change(yearInput, { target: { value: "2029" } })
    fireEvent.submit(yearInput.closest("form"))
    await waitFor(() => expect(apiFetch.mock.calls.filter((c) => c[1]?.method === "POST")).toHaveLength(2))
    expect(apiFetch.mock.calls.filter((c) => c[1]?.method === "POST")[1][1].body).toMatchObject({ startDate: undefined, endDate: undefined })

    confirmSpy.mockReturnValueOnce(false)
    await userEvent.click(screen.getAllByTitle("adminDelete")[0])
    expect(apiFetch).not.toHaveBeenCalledWith("/admin/academic-years/y1", expect.anything())
    await userEvent.click(screen.getAllByTitle("adminDelete")[0])
    expect(await screen.findByText("academicYearDeleted")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/academic-years/y1", { method: "DELETE", token: "tok" })
  })

  it("reports year errors with and without a message", async () => {
    routes({ "POST /admin/academic-years": new Error("") , "DELETE /admin/academic-years/y1": new Error("") })
    renderWithRouter(<AdminAcademicConfig />)
    await screen.findByText("2025-2026")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByText("academicYearCreateError")).toBeInTheDocument()
    await userEvent.click(screen.getAllByTitle("adminDelete")[0])
    expect(await screen.findByText("academicYearDeleteError")).toBeInTheDocument()
  })

  it("reports year errors with the server message", async () => {
    routes({ "POST /admin/academic-years": new Error("dup year"), "DELETE /admin/academic-years/y1": new Error("in use") })
    renderWithRouter(<AdminAcademicConfig />)
    await screen.findByText("2025-2026")
    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByText("dup year")).toBeInTheDocument()
    await userEvent.click(screen.getAllByTitle("adminDelete")[0])
    expect(await screen.findByText("in use")).toBeInTheDocument()
  })

  it("lists, creates and deletes series", async () => {
    routes()
    renderWithRouter(<AdminAcademicConfig />)
    await userEvent.click(screen.getByText("seriesTab"))
    expect(await screen.findByText("NS1")).toBeInTheDocument()
    expect(screen.getByText("N1")).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("seriesNameExample"), { target: { value: " Rhéto " } })
    fireEvent.change(screen.getByPlaceholderText("Ex: 3AF ou NS1"), { target: { value: " RH " } })
    fireEvent.submit(screen.getByPlaceholderText("Ex: 3AF ou NS1").closest("form"))
    expect(await screen.findByText("seriesSaved")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/series", { method: "POST", token: "tok", body: { name: "Rhéto", code: "RH" } })

    fireEvent.change(screen.getByPlaceholderText("seriesNameExample"), { target: { value: "X" } })
    fireEvent.submit(screen.getByPlaceholderText("Ex: 3AF ou NS1").closest("form"))
    await waitFor(() => expect(apiFetch.mock.calls.filter((c) => c[0] === "/admin/series" && c[1]?.method === "POST")).toHaveLength(2))
    expect(apiFetch.mock.calls.filter((c) => c[0] === "/admin/series" && c[1]?.method === "POST")[1][1].body.code).toBeUndefined()

    const deleteButtons = () => screen.getByText("NS1").closest("div").parentElement.querySelectorAll("button")
    confirmSpy.mockReturnValueOnce(false)
    fireEvent.click(deleteButtons()[0])
    fireEvent.click(deleteButtons()[0])
    expect(await screen.findByText("seriesDeleted")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/series/s1", { method: "DELETE", token: "tok" })
  })

  it("reports series errors with and without a message", async () => {
    routes({ "POST /admin/series": new Error(""), "DELETE /admin/series/s1": new Error("") })
    renderWithRouter(<AdminAcademicConfig />)
    await userEvent.click(screen.getByText("seriesTab"))
    await screen.findByText("NS1")
    fireEvent.submit(screen.getByPlaceholderText("Ex: 3AF ou NS1").closest("form"))
    expect(await screen.findByText("seriesCreateError")).toBeInTheDocument()
    fireEvent.click(screen.getByText("NS1").closest("div").parentElement.querySelector("button"))
    expect(await screen.findByText("seriesDeleteError")).toBeInTheDocument()
  })

  it("reports series errors with the server message", async () => {
    routes({ "POST /admin/series": new Error("dup series"), "DELETE /admin/series/s1": new Error("has classes") })
    renderWithRouter(<AdminAcademicConfig />)
    await userEvent.click(screen.getByText("seriesTab"))
    await screen.findByText("NS1")
    fireEvent.submit(screen.getByPlaceholderText("Ex: 3AF ou NS1").closest("form"))
    expect(await screen.findByText("dup series")).toBeInTheDocument()
    fireEvent.click(screen.getByText("NS1").closest("div").parentElement.querySelector("button"))
    expect(await screen.findByText("has classes")).toBeInTheDocument()
  })

  it("creates, toggles and removes periods", async () => {
    routes()
    renderWithRouter(<AdminAcademicConfig />)
    await userEvent.click(screen.getByText("periods"))
    expect(await screen.findByText("T1")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("period-name"), { target: { value: "T3" } })
    await userEvent.click(screen.getByText("create-period"))
    expect(await screen.findByText("periodSaved")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/academic-periods", {
      method: "POST",
      token: "tok",
      body: { name: "T3", startDate: "", endDate: "", description: "", schoolId: "sch1" },
    })

    await userEvent.click(screen.getByText("toggle-p1"))
    await userEvent.click(screen.getByText("toggle-p2"))
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/admin/academic-periods/p2/open", { method: "PATCH", token: "tok" }))
    expect(apiFetch).toHaveBeenCalledWith("/admin/academic-periods/p1/close", { method: "PATCH", token: "tok" })

    confirmSpy.mockReturnValueOnce(false)
    await userEvent.click(screen.getByText("remove-p1"))
    expect(apiFetch).not.toHaveBeenCalledWith("/admin/academic-periods/p1", expect.anything())
    await userEvent.click(screen.getByText("remove-p1"))
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/admin/academic-periods/p1", { method: "DELETE", token: "tok" }))
  })

  it("reports period errors", async () => {
    routes({
      "POST /admin/academic-periods": new Error("overlap"),
      "PATCH /admin/academic-periods/p1/close": new Error(""),
      "DELETE /admin/academic-periods/p1": new Error(""),
    })
    renderWithRouter(<AdminAcademicConfig />)
    await userEvent.click(screen.getByText("periods"))
    await screen.findByText("T1")
    await userEvent.click(screen.getByText("create-period"))
    expect(await screen.findByText("overlap")).toBeInTheDocument()
    await userEvent.click(screen.getByText("toggle-p1"))
    expect(await screen.findByText("periodUpdateError")).toBeInTheDocument()
    await userEvent.click(screen.getByText("remove-p1"))
    expect(await screen.findByText("periodDeleteError")).toBeInTheDocument()
  })

  it("reports period errors with the server message", async () => {
    routes({
      "PATCH /admin/academic-periods/p1/close": new Error("locked"),
      "DELETE /admin/academic-periods/p1": new Error("has grades"),
    })
    renderWithRouter(<AdminAcademicConfig />)
    await userEvent.click(screen.getByText("periods"))
    await screen.findByText("T1")
    await userEvent.click(screen.getByText("toggle-p1"))
    expect(await screen.findByText("locked")).toBeInTheDocument()
    await userEvent.click(screen.getByText("remove-p1"))
    expect(await screen.findByText("has grades")).toBeInTheDocument()
  })

  it("loads defaults into settings and saves them", async () => {
    routes()
    renderWithRouter(<AdminAcademicConfig />)
    await userEvent.click(screen.getByText("settings"))
    expect(await screen.findByText("pass:12|abs:3|late:2|review:7")).toBeInTheDocument()
    await userEvent.click(screen.getByText("save-settings"))
    expect(await screen.findByText("settingsSavedSuccess")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/academic-settings/sch1", {
      method: "PUT",
      token: "tok",
      body: { passAverage: 12, maxAbsencesPerCourse: 3, assignmentLateDaysLimit: 2, gradeReviewWindowDays: 7 },
    })
  })

  it("reports settings errors with and without a message", async () => {
    routes({ "PUT /admin/academic-settings/sch1": new Error("") })
    renderWithRouter(<AdminAcademicConfig />)
    await userEvent.click(screen.getByText("settings"))
    await userEvent.click(screen.getByText("save-settings"))
    expect(await screen.findByText("settingsSaveError")).toBeInTheDocument()

    routes({ "PUT /admin/academic-settings/sch1": new Error("invalid average") })
    await userEvent.click(screen.getByText("save-settings"))
    expect(await screen.findByText("invalid average")).toBeInTheDocument()
  })

  it("uses the school context tab to reload data", async () => {
    routes()
    renderWithRouter(<AdminAcademicConfig />)
    await userEvent.click(screen.getByText("schoolContext"))
    expect(screen.getByLabelText("school-id")).toHaveValue("sch1")
    fireEvent.change(screen.getByLabelText("school-id"), { target: { value: "x" } })
    expect(screen.getByLabelText("school-id")).toHaveValue("x")
    apiFetch.mockClear()
    await userEvent.click(screen.getByText("reload-periods"))
    await userEvent.click(screen.getByText("reload-settings"))
    expect(apiFetch).toHaveBeenCalledWith("/admin/academic-periods", { token: "tok" })
    expect(apiFetch).toHaveBeenCalledWith("/admin/academic-settings/sch1", { token: "tok" })
  })

  it("accepts wrapped list responses and tolerates load failures", async () => {
    routes({
      "GET /admin/academic-years": { academicYears: [{ id: "a", year: "Wrapped" }] },
      "GET /admin/series": { data: [{ id: "s", name: "WrappedSeries" }] },
      "GET /admin/academic-periods": { data: [{ id: "p", name: "WrappedPeriod" }] },
      "GET /admin/academic-settings/sch1": null,
    })
    const first = renderWithRouter(<AdminAcademicConfig />)
    expect(await screen.findByText("Wrapped")).toBeInTheDocument()
    await userEvent.click(screen.getByText("seriesTab"))
    expect(await screen.findByText("WrappedSeries")).toBeInTheDocument()
    await userEvent.click(screen.getByText("periods"))
    expect(await screen.findByText("WrappedPeriod")).toBeInTheDocument()
    await userEvent.click(screen.getByText("settings"))
    expect(screen.getByText("pass:10|abs:5|late:2|review:7")).toBeInTheDocument()
    first.unmount()

    routes({
      "GET /admin/academic-years": { data: [{ id: "b", year: "DataYear" }] },
      "GET /admin/series": {},
      "GET /admin/academic-periods": {},
      "GET /admin/academic-settings/sch1": {},
    })
    const second = renderWithRouter(<AdminAcademicConfig />)
    expect(await screen.findByText("DataYear")).toBeInTheDocument()
    await userEvent.click(screen.getByText("seriesTab"))
    expect(await screen.findByText("seriesEmpty")).toBeInTheDocument()
    await userEvent.click(screen.getByText("periods"))
    expect(screen.queryByText("toggle-p1")).toBeNull()
    second.unmount()

    routes({ "GET /admin/academic-years": {} })
    const third = renderWithRouter(<AdminAcademicConfig />)
    expect(await screen.findByText("academicYearsEmpty")).toBeInTheDocument()
    third.unmount()

    routes({
      "GET /admin/academic-years": new Error("y"),
      "GET /admin/series": new Error("s"),
      "GET /admin/academic-periods": new Error("p"),
      "GET /admin/academic-settings/sch1": new Error("st"),
    })
    renderWithRouter(<AdminAcademicConfig />)
    await waitFor(() => expect(console.error).toHaveBeenCalledTimes(4))
  })

  it("skips settings without a school and shows the saving labels", async () => {
    auth.user = null
    apiFetch.mockImplementation(async (path, options = {}) => (options.method === "POST" ? new Promise(() => {}) : []))
    renderWithRouter(<AdminAcademicConfig />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3))
    expect(apiFetch.mock.calls.some((c) => c[0].startsWith("/admin/academic-settings"))).toBe(false)

    fireEvent.submit(document.querySelector("form"))
    expect(await screen.findByText("saving")).toBeInTheDocument()
    await userEvent.click(screen.getByText("seriesTab"))
    expect(screen.getByText("saving")).toBeInTheDocument()
    await userEvent.click(screen.getByText("periods"))
    expect(screen.getByText("period-loading")).toBeInTheDocument()
    await userEvent.click(screen.getByText("schoolContext"))
    expect(screen.getByLabelText("school-id")).toHaveValue("")
  })
})
