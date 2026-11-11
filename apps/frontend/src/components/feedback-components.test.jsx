import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Star } from "lucide-react"
import { Accordion, Tabs } from "./Tabs.jsx"
import LoadingState from "./LoadingState.jsx"
import SkeletonLoader from "./SkeletonLoader.jsx"
import { Divider, HelpText, Progress, SkeletonBox, Spinner, Tooltip } from "./Utils.jsx"
import { Toast, ToastContainer } from "./Toast.jsx"
import { toast, useToast } from "./toastService.jsx"
import * as library from "./index.js"

describe("Tabs and Accordion", () => {
  it("switches tabs and notifies", async () => {
    const onTabChange = vi.fn()
    render(
      <Tabs
        className="x"
        onTabChange={onTabChange}
        tabs={[
          { label: "One", content: "first", icon: <Star /> },
          { label: "Two", content: "second" },
        ]}
      />,
    )
    expect(screen.getByText("first")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("tab", { name: "Two" }))
    expect(screen.getByText("second")).toBeInTheDocument()
    expect(onTabChange).toHaveBeenCalledWith(1)
    render(<Tabs tabs={[{ label: "Solo", content: "c" }]} defaultTab={0} />)
  })

  it("toggles accordion items", async () => {
    render(
      <Accordion
        defaultOpen={["a"]}
        items={[
          { id: "a", title: "A", content: "content-a" },
          { title: "B", content: "content-b" },
        ]}
      />,
    )
    expect(screen.getByText("content-a")).toBeInTheDocument()
    await userEvent.click(screen.getByText("A"))
    expect(screen.queryByText("content-a")).toBeNull()
    await userEvent.click(screen.getByText("B"))
    expect(screen.getByText("content-b")).toBeInTheDocument()
    render(<Accordion items={[]} className="y" />)
  })
})

describe("LoadingState", () => {
  it("renders the inline variant", () => {
    const { rerender, container } = render(<LoadingState isLoading fullHeight />)
    expect(screen.getByText("loading")).toBeInTheDocument()
    expect(container.firstChild).toHaveClass("full-height")
    rerender(<LoadingState isLoading message="wait" />)
    expect(screen.getByText("wait")).toBeInTheDocument()
    rerender(<LoadingState error="boom" />)
    expect(screen.getByText("boom")).toBeInTheDocument()
    rerender(<LoadingState success />)
    expect(screen.getByText("success")).toBeInTheDocument()
    rerender(<LoadingState success message="saved" />)
    expect(screen.getByText("saved")).toBeInTheDocument()
  })

  it("renders overlay, minimal and banner variants", () => {
    const { rerender, container } = render(<LoadingState type="overlay" isLoading />)
    expect(screen.getByText("processing")).toBeInTheDocument()
    rerender(<LoadingState type="overlay" message="m" />)
    expect(screen.getByText("m")).toBeInTheDocument()
    rerender(<LoadingState type="minimal" isLoading error="e" success />)
    expect(container.querySelector(".loading-state-minimal.active")).not.toBeNull()
    rerender(<LoadingState type="minimal" />)
    rerender(<LoadingState type="banner" isLoading error="err" success />)
    expect(screen.getByText("processing")).toBeInTheDocument()
    expect(screen.getByText("err")).toBeInTheDocument()
    expect(screen.getByText("success")).toBeInTheDocument()
    rerender(<LoadingState type="banner" isLoading success message="msg" />)
    expect(screen.getAllByText("msg")).toHaveLength(2)
    rerender(<LoadingState type="banner" />)
    rerender(<LoadingState type="unknown" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe("SkeletonLoader", () => {
  it.each(["card", "table", "section", "dashboard", "list", "other"])("renders %s", (type) => {
    const { container } = render(<SkeletonLoader type={type} count={2} className="z" />)
    expect(container.firstChild).not.toBeNull()
  })

  it("uses defaults", () => {
    const { container } = render(<SkeletonLoader />)
    expect(container.querySelectorAll(".skeleton-card")).toHaveLength(1)
  })
})

describe("Utils", () => {
  it("shows tooltips on hover in each position", () => {
    const { rerender } = render(<Tooltip content="help" />)
    fireEvent.mouseEnter(screen.getByLabelText("More information"))
    expect(screen.getByRole("tooltip")).toHaveTextContent("help")
    fireEvent.mouseLeave(screen.getByLabelText("More information"))
    expect(screen.queryByRole("tooltip")).toBeNull()
    for (const position of ["bottom", "left", "right"]) {
      rerender(<Tooltip content="x" position={position} icon={Star} />)
    }
  })

  it("renders help text, progress, dividers, spinners and skeleton boxes", () => {
    const { container } = render(
      <>
        <HelpText>tip</HelpText>
        <HelpText icon={null}>no-icon</HelpText>
        <Progress value={25} label="Upload" variant="success" />
        <Progress value={5} max={10} label="Hidden" showPercentage={false} />
        <Progress />
        <Divider label="or" />
        <Divider className="d" />
        <Spinner />
        <Spinner size="lg" label="Wait" />
        <Spinner label="" />
        <SkeletonBox className="sb" />
      </>,
    )
    expect(screen.getByText("25%")).toBeInTheDocument()
    expect(screen.queryByText("50%")).toBeNull()
    expect(screen.getByText("or")).toBeInTheDocument()
    expect(screen.getByText("loading")).toBeInTheDocument()
    expect(screen.getByText("Wait")).toBeInTheDocument()
    expect(container.querySelector(".sb")).not.toBeNull()
  })
})

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ""
  })

  it("auto-closes after the duration", async () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<Toast type="success" title="T" message="M" duration={1000} onClose={onClose} />)
    expect(screen.getByText("T")).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1300))
    expect(onClose).toHaveBeenCalled()
  })

  it("closes manually and supports no duration and unknown types", () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<Toast type="weird" duration={0} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText("Close notification"))
    act(() => vi.advanceTimersByTime(400))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("shows toasts through the service", async () => {
    expect(toast.show({ message: "x" })).toBeUndefined()
    render(<ToastContainer />)
    const onClose = vi.fn()
    const id = toast.show({ type: "info", message: "hello", onClose, duration: 0 })
    expect(typeof id).toBe("number")
    await waitFor(() => expect(screen.getByText("hello")).toBeInTheDocument())
    toast.success("ok")
    toast.error("err")
    toast.warning("warn")
    toast.info("info")
    toast.success("ok2", "Custom")
    await waitFor(() => expect(screen.getByText("Custom")).toBeInTheDocument())

    vi.useFakeTimers()
    fireEvent.click(screen.getByText("hello").closest("div.rounded-lg").querySelector("button"))
    act(() => vi.advanceTimersByTime(400))
    expect(onClose).toHaveBeenCalled()

    toast.show({ message: "no-callback", duration: 0 })
    vi.useRealTimers()
    await waitFor(() => expect(screen.getByText("no-callback")).toBeInTheDocument())
    vi.useFakeTimers()
    fireEvent.click(screen.getByText("no-callback").closest("div.rounded-lg").querySelector("button"))
    act(() => vi.advanceTimersByTime(400))
  })

  it("manages toasts with the hook", () => {
    const { result } = renderHook(() => useToast())
    act(() => result.current.showToast({ message: "a" }))
    expect(result.current.toasts).toHaveLength(1)
    act(() => result.current.removeToast(result.current.toasts[0].id))
    expect(result.current.toasts).toHaveLength(0)
  })
})

describe("component library index", () => {
  it("re-exports the public components", () => {
    expect(Object.keys(library)).toEqual(
      expect.arrayContaining(["AppShell", "Button", "Modal", "toast", "ProtectedRoute", "Feedback", "Tabs"]),
    )
  })
})
