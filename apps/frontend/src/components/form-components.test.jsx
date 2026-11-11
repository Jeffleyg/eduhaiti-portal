import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import FormField from "./FormField.jsx"
import ListItemCard from "./ListItemCard.jsx"
import { FormField as RhfField } from "./form/FormField.jsx"
import { SelectField } from "./form/SelectField.jsx"

describe("FormField (unified)", () => {
  it.each(["text", "email", "textarea", "select"])("renders %s with label, error and hint", (type) => {
    const onChange = vi.fn()
    const { rerender } = render(
      <FormField
        type={type}
        name="f"
        label="Label"
        required
        disabled
        error="Bad"
        value=""
        onChange={onChange}
        options={[{ value: "a", label: "A" }]}
      />,
    )
    expect(screen.getByText("Bad")).toBeInTheDocument()
    expect(screen.getByText("*")).toBeInTheDocument()
    rerender(<FormField type={type} name="f" hint="Hint" value="" onChange={onChange} placeholder="ph" />)
    expect(screen.getByText("Hint")).toBeInTheDocument()
    rerender(<FormField type={type} name="f" value="" onChange={onChange} />)
  })

  it("renders checkboxes and radios", async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <FormField type="checkbox" name="c" label="Accept" required error="Must" value={false} onChange={onChange} />,
    )
    await userEvent.click(screen.getByLabelText("Accept"))
    expect(onChange).toHaveBeenCalled()
    expect(screen.getByText("Must")).toBeInTheDocument()
    rerender(<FormField type="checkbox" name="c" value onChange={onChange} />)

    rerender(
      <FormField
        type="radio"
        name="r"
        label="Pick"
        required
        error="Err"
        value="a"
        onChange={onChange}
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
      />,
    )
    expect(screen.getByLabelText("A")).toBeChecked()
    await userEvent.click(screen.getByLabelText("B"))
    rerender(<FormField type="radio" name="r" hint="H" options={[]} onChange={onChange} />)
    expect(screen.getByText("H")).toBeInTheDocument()
  })

  it("renders custom children", () => {
    const { rerender } = render(
      <FormField type="custom" label="Custom" required error="E">
        <span>child</span>
      </FormField>,
    )
    expect(screen.getByText("child")).toBeInTheDocument()
    expect(screen.getByText("E")).toBeInTheDocument()
    rerender(
      <FormField type="custom" hint="H">
        <span>child</span>
      </FormField>,
    )
    expect(screen.getByText("H")).toBeInTheDocument()
  })
})

describe("ListItemCard", () => {
  it("renders details and handles clicks", async () => {
    const onClick = vi.fn()
    const onEdit = vi.fn()
    render(
      <ListItemCard
        id="x"
        title="Title"
        subtitle="Sub"
        icon={<span>icon</span>}
        preview="preview"
        status="Active"
        statusColor="green"
        tags={[{ label: "T1", color: "gray" }, { label: "T2", color: "blue" }]}
        onEdit={onEdit}
        onClick={onClick}
        isSelected
      />,
    )
    expect(screen.getByText("Sub")).toBeInTheDocument()
    expect(screen.getByText("Active")).toHaveClass("bg-emerald-100")
    await userEvent.click(screen.getByText("Title"))
    expect(onClick).toHaveBeenCalledWith("x")
    await userEvent.click(screen.getByTitle("edit"))
    expect(onEdit).toHaveBeenCalled()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("shows overflow actions", async () => {
    const onDelete = vi.fn()
    const extra = vi.fn()
    const dangerous = vi.fn()
    const { container } = render(
      <ListItemCard
        title="T"
        onEdit={vi.fn()}
        onDelete={onDelete}
        actions={[
          { label: "Extra", onClick: extra },
          { label: "Danger", onClick: dangerous, isDangerous: true },
          { label: "NoHandler" },
        ]}
      />,
    )
    await userEvent.click(screen.getByTitle("deleteAction"))
    expect(onDelete).toHaveBeenCalled()
    const more = container.querySelector(".relative > button")
    await userEvent.click(more)
    await userEvent.click(screen.getByText("Extra"))
    expect(extra).toHaveBeenCalled()
    expect(screen.queryByText("Danger")).toBeNull()
    await userEvent.click(more)
    await userEvent.click(screen.getByText("Danger"))
    expect(dangerous).toHaveBeenCalled()
    await userEvent.click(more)
    await userEvent.click(screen.getByText("NoHandler"))
    render(<ListItemCard title="plain" actions={[{ label: "Solo" }]} />)
    await userEvent.click(screen.getByTitle("Solo"))
    await userEvent.click(screen.getByText("plain"))
  })
})

function RhfHarness({ type, error, hint, label, required, disabled }) {
  const { control } = useForm({ defaultValues: { field: "", choice: "" } })
  return (
    <>
      <RhfField control={control} name="field" type={type} label={label} required={required} error={error} hint={hint} disabled={disabled} placeholder="ph" />
      <SelectField
        control={control}
        name="choice"
        label={label}
        required={required}
        error={error}
        hint={hint}
        disabled={disabled}
        options={[{ value: "a", label: "Alpha" }]}
      />
    </>
  )
}

describe("react-hook-form fields", () => {
  it.each(["text", "textarea"])("renders a %s field with label, error and hint", (type) => {
    const { rerender } = render(<RhfHarness type={type} label="Name" required error="Required!" disabled />)
    expect(screen.getAllByText("Required!")).toHaveLength(2)
    rerender(<RhfHarness type={type} hint="Help" />)
    expect(screen.getAllByText("Help")).toHaveLength(2)
    fireEvent.change(screen.getByPlaceholderText("ph"), { target: { value: "abc" } })
    expect(screen.getByPlaceholderText("ph")).toHaveValue("abc")
    rerender(<RhfHarness type={type} />)
  })

  it("selects a value through the Radix select", async () => {
    render(<RhfHarness label="Pick" />)
    await userEvent.click(screen.getByRole("combobox", { name: "Pick" }))
    await userEvent.click(await screen.findByRole("option", { name: "Alpha" }))
    expect(screen.getByRole("combobox", { name: "Pick" })).toHaveTextContent("Alpha")
  })
})
