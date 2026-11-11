import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../../test/utils.jsx"

const auth = { token: "tok" }
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => auth }))
vi.mock("../../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

// The creation modals have their own tests; here they are reduced to their callbacks.
vi.mock("../../components/CreateStudentModal.jsx", () => ({
  default: ({ onClose, onSubmit, loading, classes }) => (
    <div data-testid="student-modal">
      <span>{loading ? "student-loading" : `classes:${classes.length}`}</span>
      <button onClick={() => onSubmit({ firstName: "Ana" })}>submit-student</button>
      <button onClick={onClose}>close-student</button>
    </div>
  ),
}))
vi.mock("../../components/CreateTeacherModal.jsx", () => ({
  default: ({ onClose, onSubmit, teacherData, onChangeTeacher, onChangeTeacherClasses }) => (
    <div data-testid="teacher-modal">
      <span>teacher:{teacherData.firstName}|{teacherData.classIds.join(",")}</span>
      <input aria-label="teacher-first" name="firstName" value={teacherData.firstName} onChange={onChangeTeacher} />
      <select aria-label="teacher-classes" multiple value={teacherData.classIds} onChange={onChangeTeacherClasses}>
        <option value="c1">c1</option>
        <option value="c2">c2</option>
      </select>
      <button onClick={() => onSubmit({ firstName: teacherData.firstName })}>submit-teacher</button>
      <button onClick={onClose}>close-teacher</button>
    </div>
  ),
}))

import { apiFetch } from "../../lib/api.js"
import AdminDisciplineManagement from "./AdminDisciplineManagement.jsx"
import AdminUsers from "./AdminUsers.jsx"

beforeEach(() => {
  apiFetch.mockReset()
  auth.token = "tok"
})

describe("AdminDisciplineManagement", () => {
  const series = [{ id: "s1", name: "NS1", academicYear: { year: "2026" } }, { id: "s2", name: "NS2" }]
  const disciplines = [
    { id: "d1", name: "Math", code: "MAT", credits: 4, series: { name: "NS1" } },
    { id: "d2", name: "Bio" },
  ]
  const routes = () =>
    apiFetch.mockImplementation(async (path) => {
      if (path === "/admin/classes/meta/series") return series
      if (path.startsWith("/admin/disciplines?")) return disciplines
      return {}
    })

  const pickSeries = async (id = "s1") => {
    await screen.findByText("NS1 (2026)")
    fireEvent.change(screen.getByRole("combobox"), { target: { value: id } })
  }

  it("loads disciplines for the selected series", async () => {
    routes()
    renderWithRouter(<AdminDisciplineManagement />)
    // The series selector is visible on the default tab.
    expect(await screen.findByText("NS1 (2026)")).toBeInTheDocument()
    await pickSeries()
    expect(await screen.findByText("Math")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/disciplines?seriesId=s1", { token: "tok" })
    expect(screen.getByText("MAT", { selector: "p.font-semibold" })).toBeInTheDocument()
    expect(screen.getAllByText("-").length).toBeGreaterThan(0)

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } })
    expect(screen.queryByText("Math")).toBeNull()
  })

  it("creates a discipline", async () => {
    routes()
    renderWithRouter(<AdminDisciplineManagement />)
    await pickSeries()
    await screen.findByText("Math")
    fireEvent.change(screen.getByPlaceholderText("adminDisciplineName"), { target: { value: "Chimie" } })
    fireEvent.change(screen.getByPlaceholderText("adminDisciplineCode"), { target: { value: "CHI" } })
    fireEvent.change(screen.getByPlaceholderText("adminDisciplineCredits"), { target: { value: "3" } })
    fireEvent.submit(screen.getByText("adminCreate").closest("form"))
    expect(await screen.findByText("adminDisciplineCreated")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/disciplines", {
      method: "POST",
      token: "tok",
      body: { seriesId: "s1", name: "Chimie", code: "CHI", credits: 3 },
    })
    expect(screen.getByPlaceholderText("adminDisciplineName")).toHaveValue("")
  })

  it("edits, cancels and updates a discipline", async () => {
    routes()
    renderWithRouter(<AdminDisciplineManagement />)
    await pickSeries()
    await screen.findByText("Math")
    await userEvent.click(screen.getAllByTitle("Edit")[1])
    expect(screen.getByText("adminEditDiscipline")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("adminDisciplineName")).toHaveValue("Bio")
    expect(screen.getByPlaceholderText("adminDisciplineCode")).toHaveValue("")
    await userEvent.click(screen.getByText("adminCancel"))
    expect(screen.getByText("adminCreateDiscipline")).toBeInTheDocument()

    await userEvent.click(screen.getAllByTitle("Edit")[0])
    fireEvent.change(screen.getByPlaceholderText("adminDisciplineName"), { target: { value: "Maths" } })
    fireEvent.submit(screen.getByText("adminUpdate").closest("form"))
    expect(await screen.findByText("adminDisciplineUpdated")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/disciplines/d1", {
      method: "PUT",
      token: "tok",
      body: { name: "Maths", code: "MAT", credits: 4 },
    })
  })

  it("reports submit errors", async () => {
    routes()
    renderWithRouter(<AdminDisciplineManagement />)
    await pickSeries()
    await screen.findByText("Math")
    fireEvent.change(screen.getByPlaceholderText("adminDisciplineName"), { target: { value: "X" } })
    apiFetch.mockRejectedValueOnce(new Error("save failed"))
    fireEvent.submit(screen.getByText("adminCreate").closest("form"))
    expect(await screen.findByText("save failed")).toBeInTheDocument()
  })

  it("deletes a discipline after confirmation", async () => {
    routes()
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true)
    renderWithRouter(<AdminDisciplineManagement />)
    await pickSeries()
    await screen.findByText("Math")
    await userEvent.click(screen.getAllByTitle("Delete")[0])
    expect(apiFetch).not.toHaveBeenCalledWith("/admin/disciplines/d1", expect.anything())

    await userEvent.click(screen.getAllByTitle("Delete")[0])
    expect(await screen.findByText("adminDisciplineDeleted")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/disciplines/d1", { method: "DELETE", token: "tok" })

    apiFetch.mockRejectedValueOnce(new Error("delete failed"))
    await userEvent.click(screen.getAllByTitle("Delete")[0])
    expect(await screen.findByText("delete failed")).toBeInTheDocument()
    confirm.mockRestore()
  })

  it("handles empty and failed loads, the loader and no token", async () => {
    apiFetch.mockImplementation(async (path) => {
      if (path === "/admin/classes/meta/series") return series
      return null
    })
    const first = renderWithRouter(<AdminDisciplineManagement />)
    await pickSeries()
    expect(await screen.findByText("noData")).toBeInTheDocument()

    apiFetch.mockRejectedValueOnce(new Error("disciplines failed"))
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "s2" } })
    expect(await screen.findByText("disciplines failed")).toBeInTheDocument()

    apiFetch.mockImplementationOnce(() => new Promise(() => {}))
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "s1" } })
    expect(await screen.findByText("loading")).toBeInTheDocument()
    first.unmount()

    apiFetch.mockReset()
    apiFetch.mockResolvedValueOnce(null)
    const second = renderWithRouter(<AdminDisciplineManagement />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1))
    expect(screen.getAllByRole("option")).toHaveLength(1)
    second.unmount()

    apiFetch.mockRejectedValueOnce(new Error("series failed"))
    const third = renderWithRouter(<AdminDisciplineManagement />)
    expect(await screen.findByText("series failed")).toBeInTheDocument()
    third.unmount()

    apiFetch.mockClear()
    auth.token = null
    renderWithRouter(<AdminDisciplineManagement />)
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it("requires a series on submit", async () => {
    // The form is only rendered with a series selected; guard against a whitespace-only id.
    apiFetch.mockImplementation(async (path) => (path === "/admin/classes/meta/series" ? [{ id: " ", name: "Blank" }] : []))
    renderWithRouter(<AdminDisciplineManagement />)
    await screen.findByText(/Blank/)
    fireEvent.change(screen.getByRole("combobox"), { target: { value: " " } })
    fireEvent.change(screen.getByPlaceholderText("adminDisciplineName"), { target: { value: "X" } })
    fireEvent.submit(screen.getByText("adminCreate").closest("form"))
    expect(await screen.findByText("adminSelectSeriesRequired")).toBeInTheDocument()
  })
})

describe("AdminUsers", () => {
  const routes = (overrides = {}) =>
    apiFetch.mockImplementation(async (path, options = {}) => {
      const key = `${options.method ?? "GET"} ${path}`
      if (key in overrides) {
        const v = overrides[key]
        if (v instanceof Error) throw v
        return v
      }
      if (path === "/admin/classes") return [{ id: "c1", name: "3e" }]
      if (path === "/admin/users/students")
        return [
          { id: "s1", name: "Ana", email: "ana@x", enrollmentNumber: "E1", classesAttending: [{ id: "c1" }], fatherName: "P" },
          { id: "s2", name: "Bob", email: "bob@x" },
        ]
      if (path === "/admin/users/teachers")
        return [
          { id: "t1", name: "Jean", email: "jean@x", enrollmentNumber: "T1", classesTeaching: [{}, {}], subjects: ["Math", "Bio"] },
          { id: "t2", name: "Paul", email: "paul@x", classIds: ["c1"] },
          { id: "t3", name: "Rose", email: "rose@x" },
        ]
      return {}
    })

  it("lists students and teachers", async () => {
    routes()
    renderWithRouter(<AdminUsers />)
    expect(await screen.findByText("ana@x")).toBeInTheDocument()
    expect(screen.getByText("enrolled")).toBeInTheDocument()
    expect(screen.getByText("notEnrolled")).toBeInTheDocument()
    expect(screen.getByText("withData")).toBeInTheDocument()

    await userEvent.click(screen.getByText("teachers", { selector: "button" }))
    expect(await screen.findByText("jean@x")).toBeInTheDocument()
    expect(screen.getByText("Math, Bio")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getAllByText("1").length).toBeGreaterThan(0)
  })

  it("creates a student and refreshes the lists", async () => {
    routes()
    renderWithRouter(<AdminUsers />)
    await screen.findByText("ana@x")
    await userEvent.click(screen.getByText("createStudentTitle", { selector: "button" }))
    expect(screen.getByText("classes:1")).toBeInTheDocument()
    await userEvent.click(screen.getByText("submit-student"))
    expect(await screen.findByText("studentCreated")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/users/students", { method: "POST", token: "tok", body: { firstName: "Ana" } })
    expect(screen.queryByTestId("student-modal")).toBeNull()
    expect(apiFetch.mock.calls.filter((c) => c[0] === "/admin/users/teachers")).toHaveLength(2)
  })

  it("shows the temporary password once when the e-mail could not be sent", async () => {
    routes({
      "POST /admin/users/students": { email: "ana@x", emailSent: false, tempPassword: "TmpPass123" },
      "POST /admin/users/teachers": { email: "t@x", emailSent: true },
    })
    renderWithRouter(<AdminUsers />)
    await screen.findByText("ana@x")
    await userEvent.click(screen.getByText("createStudentTitle", { selector: "button" }))
    await userEvent.click(screen.getByText("submit-student"))
    expect(await screen.findByTestId("temp-password")).toHaveTextContent("TmpPass123")
    expect(screen.getByText("tempPasswordNotEmailed")).toBeInTheDocument()

    await userEvent.click(screen.getByText("createTeacherTitle", { selector: "button" }))
    await userEvent.click(screen.getByText("submit-teacher"))
    await screen.findByText("teacherCreated")
    expect(screen.queryByTestId("temp-password")).toBeNull()
  })

  it("reports student errors and closes the modal both ways", async () => {
    routes({ "POST /admin/users/students": new Error("student failed") })
    renderWithRouter(<AdminUsers />)
    await screen.findByText("ana@x")
    await userEvent.click(screen.getByText("createStudentTitle", { selector: "button" }))
    await userEvent.click(screen.getByText("submit-student"))
    expect(await screen.findByText("student failed")).toBeInTheDocument()
    await userEvent.click(screen.getByText("close-student"))
    expect(screen.queryByTestId("student-modal")).toBeNull()

    await userEvent.click(screen.getByText("createStudentTitle", { selector: "button" }))
    await userEvent.click(screen.getByLabelText("Close modal"))
    expect(screen.queryByTestId("student-modal")).toBeNull()
  })

  it("creates a teacher with the shared form state", async () => {
    routes()
    renderWithRouter(<AdminUsers />)
    await screen.findByText("ana@x")
    await userEvent.click(screen.getByText("createTeacherTitle", { selector: "button" }))
    fireEvent.change(screen.getByLabelText("teacher-first"), { target: { value: "Luc" } })
    const select = screen.getByLabelText("teacher-classes")
    select.options[0].selected = true
    select.options[1].selected = true
    fireEvent.change(select)
    expect(screen.getByText("teacher:Luc|c1,c2")).toBeInTheDocument()
    await userEvent.click(screen.getByText("submit-teacher"))
    expect(await screen.findByText("teacherCreated")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/admin/users/teachers", { method: "POST", token: "tok", body: { firstName: "Luc" } })

    await userEvent.click(screen.getByText("createTeacherTitle", { selector: "button" }))
    expect(screen.getByText("teacher:|")).toBeInTheDocument()
  })

  it("reports teacher errors and resets the form when closing", async () => {
    routes({ "POST /admin/users/teachers": new Error("teacher failed") })
    renderWithRouter(<AdminUsers />)
    await screen.findByText("ana@x")
    await userEvent.click(screen.getByText("createTeacherTitle", { selector: "button" }))
    fireEvent.change(screen.getByLabelText("teacher-first"), { target: { value: "Luc" } })
    await userEvent.click(screen.getByText("submit-teacher"))
    expect(await screen.findByText("teacher failed")).toBeInTheDocument()

    await userEvent.click(screen.getByText("close-teacher"))
    await userEvent.click(screen.getByText("createTeacherTitle", { selector: "button" }))
    expect(screen.getByText("teacher:|")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("teacher-first"), { target: { value: "Luc" } })
    await userEvent.click(screen.getByLabelText("Close modal"))
    await userEvent.click(screen.getByText("createTeacherTitle", { selector: "button" }))
    expect(screen.getByText("teacher:|")).toBeInTheDocument()
  })

  it("shows the loading flag while creating", async () => {
    routes()
    renderWithRouter(<AdminUsers />)
    await screen.findByText("ana@x")
    await userEvent.click(screen.getByText("createStudentTitle", { selector: "button" }))
    apiFetch.mockImplementationOnce(() => new Promise(() => {}))
    await userEvent.click(screen.getByText("submit-student"))
    expect(await screen.findByText("student-loading")).toBeInTheDocument()
  })

  it("handles empty and failed loads and no token", async () => {
    apiFetch.mockResolvedValue(null)
    const first = renderWithRouter(<AdminUsers />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3))
    expect(await screen.findByText("noData")).toBeInTheDocument()
    await userEvent.click(screen.getByText("teachers", { selector: "button" }))
    expect(screen.getByText("noData")).toBeInTheDocument()
    await userEvent.click(screen.getByText("createStudentTitle", { selector: "button" }))
    await userEvent.click(screen.getByText("submit-student"))
    expect(await screen.findByText("studentCreated")).toBeInTheDocument()
    first.unmount()

    apiFetch.mockRejectedValue(new Error("load failed"))
    const second = renderWithRouter(<AdminUsers />)
    expect(await screen.findByText("load failed")).toBeInTheDocument()
    second.unmount()

    apiFetch.mockClear()
    auth.token = null
    renderWithRouter(<AdminUsers />)
    expect(apiFetch).not.toHaveBeenCalled()
  })
})
