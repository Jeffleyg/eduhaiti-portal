import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CreateStudentModal from "./CreateStudentModal.jsx"
import CreateTeacherModal from "./CreateTeacherModal.jsx"

const classes = [{ id: "c1", name: "3e", level: "A" }]

async function pick(label, option) {
  await userEvent.click(screen.getByRole("combobox", { name: label }))
  await userEvent.click(await screen.findByRole("option", { name: option }))
}

function type(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

describe("CreateStudentModal", () => {
  it("validates required fields", async () => {
    const onSubmit = vi.fn()
    render(<CreateStudentModal onClose={vi.fn()} onSubmit={onSubmit} classes={classes} />)
    await userEvent.click(screen.getByText("createStudentAction"))
    expect(await screen.findByText("Email é obrigatório")).toBeInTheDocument()
    expect(screen.getByText("Selecione um gênero válido")).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("submits a valid student and resets", async () => {
    const onSubmit = vi.fn(async () => {})
    render(<CreateStudentModal onClose={vi.fn()} onSubmit={onSubmit} classes={classes} />)
    type("email", "a@b.ht")
    type("firstName", "Ana")
    type("lastName", "Lima")
    type("dateOfBirth", "2012-01-01")
    type("address", "Rue 1, Cap")
    await pick("gender", "genderFemale")
    await pick("class", "3e (A)")
    await userEvent.click(screen.getByText("createStudentAction"))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      email: "a@b.ht",
      gender: "FEMALE",
      classId: "c1",
      fatherName: null,
      motherName: null,
      fatherPhone: undefined,
      motherPhone: undefined,
    })
    await waitFor(() => expect(screen.getByLabelText("email")).toHaveValue(""))
  })

  it("sends guardian phones and rejects invalid ones", async () => {
    const onSubmit = vi.fn(async () => {})
    render(<CreateStudentModal onClose={vi.fn()} onSubmit={onSubmit} classes={classes} />)
    type("email", "a@b.ht")
    type("firstName", "Ana")
    type("lastName", "Lima")
    type("dateOfBirth", "2012-01-01")
    type("address", "Rue 1, Cap")
    await pick("gender", "genderFemale")
    await pick("class", "3e (A)")
    type("fatherPhone", "12ab")
    await userEvent.click(screen.getByText("createStudentAction"))
    expect(await screen.findByText("Telefone do pai inválido")).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    type("fatherPhone", " +509 3712-3456 ")
    type("motherPhone", "3800 0000")
    await userEvent.click(screen.getByText("createStudentAction"))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ fatherPhone: "+509 3712-3456", motherPhone: "3800 0000" })
  })

  it("logs submission failures and closes", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const onClose = vi.fn()
    const onSubmit = vi.fn(async () => {
      throw new Error("api")
    })
    render(<CreateStudentModal onClose={onClose} onSubmit={onSubmit} classes={classes} loading={false} />)
    type("email", "a@b.ht")
    type("firstName", "Ana")
    type("lastName", "Lima")
    type("dateOfBirth", "2012-01-01")
    type("address", "Rue 1, Cap")
    type("fatherName", "Jean")
    await pick("gender", "genderMale")
    await pick("class", "3e (A)")
    await userEvent.click(screen.getByText("createStudentAction"))
    await waitFor(() => expect(error).toHaveBeenCalled())
    await userEvent.click(screen.getByText("cancel"))
    expect(onClose).toHaveBeenCalled()
  })
})

describe("CreateTeacherModal", () => {
  const fill = () => {
    type("email", "t@x.ht")
    type("firstName", "Tom")
    type("lastName", "Ray")
    type("dateOfBirth", "1990-01-01")
    type("address", "Delmas 31")
    type("subjects", "Math, , Physique")
  }

  it("submits subjects as a list and filters empty new classes", async () => {
    const onSubmit = vi.fn(async () => {})
    render(<CreateTeacherModal onClose={vi.fn()} onSubmit={onSubmit} classes={classes} />)
    fill()
    await userEvent.click(screen.getByText(/addClass/))
    await userEvent.click(screen.getByText(/addClass/))
    await userEvent.click(screen.getByText(/addClass/))
    const names = screen.getAllByPlaceholderText("className")
    fireEvent.change(names[0], { target: { value: "3e-B" } })
    fireEvent.change(screen.getAllByPlaceholderText("classLevel")[0], { target: { value: "3e" } })
    fireEvent.change(names[1], { target: { value: "   " } })
    await userEvent.click(screen.getAllByText("✕")[2])
    expect(screen.getAllByPlaceholderText("className")).toHaveLength(2)
    await userEvent.click(screen.getByText("createTeacherAction"))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      subjects: ["Math", "Physique"],
      newClasses: [{ name: "3e-B", level: "3e" }],
      gender: "MALE",
    })
  })

  it("assigns existing classes picked in the list", async () => {
    const onSubmit = vi.fn(async () => {})
    const twoClasses = [...classes, { id: "c2", name: "4e", level: "B" }]
    render(<CreateTeacherModal onClose={vi.fn()} onSubmit={onSubmit} classes={twoClasses} />)
    expect(screen.getByText("existingClasses")).toBeInTheDocument()
    fill()
    await userEvent.click(screen.getByLabelText("4e (B)"))
    await userEvent.click(screen.getByText("createTeacherAction"))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].classIds).toEqual(["c2"])
  })

  it("hides the class list when the school has no classes", () => {
    render(<CreateTeacherModal onClose={vi.fn()} onSubmit={vi.fn()} classes={[]} />)
    expect(screen.queryByText("existingClasses")).toBeNull()
  })

  it("prefills from teacher data and handles failures", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const onClose = vi.fn()
    const onSubmit = vi.fn(async () => {
      throw new Error("api")
    })
    const { unmount } = render(
      <CreateTeacherModal
        onClose={onClose}
        onSubmit={onSubmit}
        loading
        teacherData={{
          email: "p@x.ht",
          firstName: "Pre",
          lastName: "Filled",
          dateOfBirth: "1980-01-01",
          address: "Address 10",
          gender: "OTHER",
          fatherName: "F",
          motherName: "M",
          subjects: ["A", "B"],
          classIds: ["c1"],
        }}
      />,
    )
    expect(screen.getByLabelText("email")).toHaveValue("p@x.ht")
    expect(screen.getByLabelText("subjects")).toHaveValue("A, B")
    expect(screen.getByText("createTeacherAction").closest("button")).toBeDisabled()
    unmount()

    render(
      <CreateTeacherModal onClose={onClose} onSubmit={onSubmit} teacherData={{ subjects: "Chimie" }} />,
    )
    expect(screen.getByLabelText("subjects")).toHaveValue("Chimie")
    fill()
    await userEvent.click(screen.getByText("createTeacherAction"))
    await waitFor(() => expect(error).toHaveBeenCalled())
    await userEvent.click(screen.getByText("cancel"))
    expect(onClose).toHaveBeenCalled()
  })

  it("shows validation errors", async () => {
    render(<CreateTeacherModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByText("createTeacherAction"))
    expect(await screen.findByText(/Informe ao menos uma disciplina/)).toBeInTheDocument()
  })
})
