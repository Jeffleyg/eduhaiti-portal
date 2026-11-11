import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Star } from "lucide-react"
import Input from "./Input.jsx"
import SectionCard from "./SectionCard.jsx"
import SectionHeader from "./SectionHeader.jsx"
import StatCard from "./StatCard.jsx"
import Feedback from "./Feedback.jsx"
import PeriodsList from "./admin/PeriodsList.jsx"
import PeriodForm from "./admin/PeriodForm.jsx"
import SchoolContext from "./admin/SchoolContext.jsx"
import AdminSectionToolbar from "./AdminSectionToolbar.jsx"
import DataTable from "./DataTable.jsx"
import PaginationControls from "./PaginationControls.jsx"
import Badge from "./Badge.jsx"
import Card from "./Card.jsx"
import Button from "./Button.jsx"
import Modal from "./Modal.jsx"
import Alert from "./Alert.jsx"
import EmptyState from "./EmptyState.jsx"
import LoadMoreList from "./LoadMoreList.jsx"
import SurvivalModeBlockedBanner from "./SurvivalModeBlockedBanner.jsx"
import SelectComponent from "./Select.jsx"

const t = (k) => k

describe("simple layout components", () => {
  it("renders inputs, cards, headers and stats", () => {
    render(
      <>
        <Input placeholder="name" className="extra" />
        <Input placeholder="plain" />
        <SectionCard className="c">content</SectionCard>
        <SectionCard>plain</SectionCard>
        <SectionHeader title="Title" subtitle="Sub" />
        <SectionHeader title="NoSub" />
        <StatCard label="Students" value={42} />
      </>,
    )
    expect(screen.getByPlaceholderText("name")).toHaveClass("extra")
    expect(screen.getByText("content")).toHaveClass("c")
    expect(screen.getByText("Sub")).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
  })

  it("renders feedback only when needed", () => {
    const { container, rerender } = render(<Feedback />)
    expect(container).toBeEmptyDOMElement()
    rerender(<Feedback error="bad" message="ok" />)
    expect(screen.getByText("bad")).toBeInTheDocument()
    expect(screen.getByText("ok")).toBeInTheDocument()
    rerender(<Feedback message="only" />)
    expect(screen.queryByText("bad")).toBeNull()
  })

  it("supports typed, dismissable feedback", async () => {
    const onClose = vi.fn()
    const { rerender } = render(<Feedback type="error" message="failed" onClose={onClose} />)
    expect(screen.getByText("failed")).toHaveClass("text-brand-red")
    await userEvent.click(screen.getByLabelText("Fechar mensagem"))
    expect(onClose).toHaveBeenCalled()
    rerender(<Feedback type="success" message="saved" />)
    expect(screen.getByText("saved")).toHaveClass("text-emerald-600")
    expect(screen.queryByLabelText("Fechar mensagem")).toBeNull()
  })
})

describe("admin period components", () => {
  it("lists periods and triggers actions", async () => {
    const toggle = vi.fn()
    const remove = vi.fn()
    const { rerender } = render(<PeriodsList t={t} periods={[]} togglePeriod={toggle} removePeriod={remove} />)
    expect(screen.getByText("noData")).toBeInTheDocument()
    rerender(<PeriodsList t={t} togglePeriod={toggle} removePeriod={remove} />)
    expect(screen.getByText("noData")).toBeInTheDocument()

    rerender(
      <PeriodsList
        t={t}
        togglePeriod={toggle}
        removePeriod={remove}
        periods={[
          { id: "1", name: "T1", startDate: "2026-01-01T00:00", endDate: "2026-03-01T00:00", isOpen: true, description: "d" },
          { id: "2", name: "T2", isOpen: false },
        ]}
      />,
    )
    expect(screen.getByText("academicStatusOpen")).toBeInTheDocument()
    expect(screen.getByText("academicStatusClosed")).toBeInTheDocument()
    expect(screen.getByText("2026-01-01 - 2026-03-01")).toBeInTheDocument()
    await userEvent.click(screen.getByText("academicClose"))
    await userEvent.click(screen.getByText("academicOpen"))
    await userEvent.click(screen.getAllByText("academicDelete")[1])
    expect(toggle).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenCalledWith("2")
  })

  it("edits and submits the period form", async () => {
    let form = { name: "", startDate: "", endDate: "", description: "" }
    const setPeriodForm = vi.fn((updater) => {
      form = updater(form)
    })
    const createPeriod = vi.fn((e) => e.preventDefault())
    const { container } = render(
      <PeriodForm t={t} periodForm={form} setPeriodForm={setPeriodForm} createPeriod={createPeriod} loading={false} />,
    )
    fireEvent.change(screen.getByPlaceholderText("academicPeriodName"), { target: { value: "T1" } })
    const dates = container.querySelectorAll('input[type="date"]')
    fireEvent.change(dates[0], { target: { value: "2026-01-01" } })
    fireEvent.change(dates[1], { target: { value: "2026-02-01" } })
    fireEvent.change(screen.getByPlaceholderText("academicPeriodDescription"), { target: { value: "D" } })
    expect(form).toEqual({ name: "T1", startDate: "2026-01-01", endDate: "2026-02-01", description: "D" })
    fireEvent.submit(container.querySelector("form"))
    expect(createPeriod).toHaveBeenCalled()
  })

  it("shows the school context as input or locked", async () => {
    const setSchoolId = vi.fn()
    const loadPeriods = vi.fn()
    const loadSettings = vi.fn()
    const { rerender } = render(
      <SchoolContext t={t} schoolId="" setSchoolId={setSchoolId} loadPeriods={loadPeriods} loadSettings={loadSettings} />,
    )
    fireEvent.change(screen.getByPlaceholderText("academicSchoolIdPlaceholder"), { target: { value: "s1" } })
    expect(setSchoolId).toHaveBeenCalledWith("s1")
    await userEvent.click(screen.getByText("academicLoadPeriods"))
    await userEvent.click(screen.getByText("academicLoadSettings"))
    expect(loadPeriods).toHaveBeenCalled()
    expect(loadSettings).toHaveBeenCalled()

    rerender(<SchoolContext t={() => ""} schoolId="" locked loadPeriods={loadPeriods} loadSettings={loadSettings} />)
    expect(screen.getByText("-")).toBeInTheDocument()
    rerender(<SchoolContext t={t} schoolId="abc" locked loadPeriods={loadPeriods} loadSettings={loadSettings} />)
    expect(screen.getByText("abc")).toBeInTheDocument()
    rerender(<SchoolContext t={() => ""} schoolId="" setSchoolId={setSchoolId} loadPeriods={loadPeriods} loadSettings={loadSettings} />)
    expect(screen.getByPlaceholderText("school-uuid or name")).toBeInTheDocument()
  })
})

describe("navigation and tables", () => {
  it("switches toolbar sections", async () => {
    const onChange = vi.fn()
    render(<AdminSectionToolbar sections={[{ key: "a", label: "A" }, { key: "b", label: "B" }]} active="a" onChange={onChange} />)
    expect(screen.getByText("A")).toHaveClass("primary-button")
    expect(screen.getByText("B")).toHaveClass("outline-button")
    await userEvent.click(screen.getByText("B"))
    expect(onChange).toHaveBeenCalledWith("b")
    render(<AdminSectionToolbar onChange={onChange} />)
  })

  it("renders a data table", () => {
    render(<DataTable columns={[{ key: "n", label: "Name" }]} rows={[{ n: "Ana" }, { n: "Bob" }]} />)
    expect(screen.getByText("Name")).toBeInTheDocument()
    expect(screen.getAllByRole("row")).toHaveLength(3)
  })

  it("paginates", async () => {
    const prev = vi.fn()
    const next = vi.fn()
    const { container, rerender } = render(<PaginationControls currentPage={1} totalPages={1} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<PaginationControls currentPage={1} totalPages={3} previousLabel="P" continueLabel="N" onPrevious={prev} onContinue={next} />)
    expect(screen.getByText("P")).toBeDisabled()
    await userEvent.click(screen.getByText("N"))
    expect(next).toHaveBeenCalled()
    rerender(<PaginationControls currentPage={3} totalPages={3} previousLabel="P" continueLabel="N" onPrevious={prev} onContinue={next} />)
    expect(screen.getByText("N")).toBeDisabled()
    await userEvent.click(screen.getByText("P"))
    expect(prev).toHaveBeenCalled()
  })

  it("loads more items page by page", async () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ id: i, name: `item-${i}` }))
    const { rerender } = render(<LoadMoreList items={items} step={3} renderItem={(it) => <span>{it.name}</span>} />)
    expect(screen.getByText("item-0")).toBeInTheDocument()
    expect(screen.queryByText("item-3")).toBeNull()
    await userEvent.click(screen.getByText("continue"))
    expect(screen.getByText("item-3")).toBeInTheDocument()
    await userEvent.click(screen.getByText("continue"))
    await userEvent.click(screen.getByText("previous"))
    expect(screen.getByText("item-4")).toBeInTheDocument()

    // shrinking the list clamps the page
    await userEvent.click(screen.getByText("continue"))
    rerender(<LoadMoreList items={items.slice(0, 2)} step={3} renderItem={(it) => <span>{it.name}</span>} />)
    expect(await screen.findByText("item-1")).toBeInTheDocument()

    rerender(
      <LoadMoreList
        items={[{ name: "no-id" }]}
        step={0}
        initialLimit={0}
        continueLabel="C"
        previousLabel="V"
        renderItem={(it) => <span>{it.name}</span>}
      />,
    )
    expect(screen.getByText("no-id")).toBeInTheDocument()
    rerender(<LoadMoreList items={[]} renderItem={() => null} />)
    expect(screen.getByText("Nenhum item.")).toBeInTheDocument()
    rerender(<LoadMoreList items={null} renderItem={() => null} />)
    expect(screen.getByText("Nenhum item.")).toBeInTheDocument()
  })
})

describe("display components", () => {
  it("renders badges in every size", () => {
    render(
      <>
        <Badge>default</Badge>
        <Badge variant="success" size="sm" icon={Star}>small</Badge>
        <Badge size="lg" icon={Star}>
          <b>large</b>
        </Badge>
        <Badge icon={Star}>medium</Badge>
      </>,
    )
    expect(screen.getByLabelText("default")).toHaveClass("badge-primary")
    expect(screen.getByLabelText("small")).toHaveClass("badge-success")
    expect(screen.getByText("large").closest("span")).not.toHaveAttribute("aria-label")
  })

  it("renders cards with header/footer and keyboard clicks", () => {
    const onClick = vi.fn()
    render(
      <>
        <Card header="H" footer="F" variant="elevated">body</Card>
        <Card variant="unknown" clickable onClick={onClick}>
          clickable
        </Card>
        <Card clickable>no-handler</Card>
      </>,
    )
    expect(screen.getByText("H")).toBeInTheDocument()
    const clickable = screen.getByText("clickable").closest('[role="button"]')
    fireEvent.keyDown(clickable, { key: "Enter" })
    fireEvent.keyDown(clickable, { key: " " })
    fireEvent.keyDown(clickable, { key: "a" })
    expect(onClick).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(screen.getByText("no-handler").closest('[role="button"]'), { key: "Enter" })
  })

  it("renders buttons in each state", async () => {
    const onClick = vi.fn()
    render(
      <>
        <Button onClick={onClick} icon={Star} fullWidth>
          go
        </Button>
        <Button variant="danger" size="lg" loading>
          busy
        </Button>
        <Button variant="nope" size="nope" disabled>
          off
        </Button>
      </>,
    )
    await userEvent.click(screen.getByText("go"))
    expect(onClick).toHaveBeenCalled()
    expect(screen.getByText("busy").closest("button")).toHaveAttribute("aria-busy", "true")
    expect(screen.getByText("off").closest("button")).toBeDisabled()
    expect(screen.getByText("off").closest("button").className).toContain("btn-primary")
  })

  it("opens and closes the modal", async () => {
    const onClose = vi.fn()
    const { rerender, container } = render(<Modal isOpen={false} onClose={onClose} title="T" />)
    expect(container).toBeEmptyDOMElement()
    expect(document.body.style.overflow).toBe("auto")
    rerender(
      <Modal isOpen onClose={onClose} title="T" size="lg" actions={<button>ok</button>}>
        body
      </Modal>,
    )
    expect(document.body.style.overflow).toBe("hidden")
    await userEvent.click(screen.getByLabelText("Close modal"))
    fireEvent.click(screen.getByText("body"))
    fireEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalledTimes(2)
    rerender(<Modal isOpen onClose={onClose} title="T2" />)
    expect(screen.getByText("T2")).toBeInTheDocument()
  })

  it("renders alerts with close button", async () => {
    const onClose = vi.fn()
    render(
      <>
        <Alert variant="success" title="Done" onClose={onClose}>
          ok
        </Alert>
        <Alert variant="weird" closeable={false} onClose={onClose}>
          plain
        </Alert>
        <Alert variant="danger">danger</Alert>
        <Alert variant="warning">warn</Alert>
      </>,
    )
    expect(screen.getByText("Done")).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText("Close alert"))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getAllByLabelText("Close alert")).toHaveLength(1)
  })

  it("renders empty states", async () => {
    const action = vi.fn()
    render(
      <>
        <EmptyState />
        <EmptyState title="Empty" description="" action={action} actionLabel="Add" />
      </>,
    )
    expect(screen.getByText("Nenhum dado")).toBeInTheDocument()
    await userEvent.click(screen.getByText("Add"))
    expect(action).toHaveBeenCalled()
  })

  it("renders the survival-mode banner", async () => {
    const onDismiss = vi.fn()
    const { rerender } = render(<SurvivalModeBlockedBanner />)
    expect(screen.getByText(/não é essencial/)).toBeInTheDocument()
    rerender(<SurvivalModeBlockedBanner reason="low-battery" message="custom" onDismiss={onDismiss} />)
    expect(screen.getByText("custom")).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText("Descartar"))
    expect(onDismiss).toHaveBeenCalled()
  })
})

describe("SelectComponent", () => {
  const options = [
    { value: "", label: "None" },
    { value: "a", label: "Alpha" },
  ]

  it("selects options and maps the empty value", async () => {
    const onValueChange = vi.fn()
    render(<SelectComponent aria-label="pick" options={options} value="" onValueChange={onValueChange} className="x" />)
    await userEvent.click(screen.getByLabelText("pick"))
    await userEvent.click(await screen.findByRole("option", { name: "Alpha" }))
    expect(onValueChange).toHaveBeenLastCalledWith("a")
    await userEvent.click(screen.getByLabelText("pick"))
    await userEvent.click(await screen.findByRole("option", { name: "None" }))
    expect(onValueChange).toHaveBeenLastCalledWith("")
  })

  it("ignores changes without a handler and accepts undefined values", async () => {
    render(<SelectComponent aria-label="pick" options={options} value={undefined} />)
    await userEvent.click(screen.getByLabelText("pick"))
    await userEvent.click(await screen.findByRole("option", { name: "Alpha" }))
    render(<SelectComponent aria-label="defaults" />)
    expect(screen.getByLabelText("defaults")).toHaveTextContent("Selecione...")
  })
})
