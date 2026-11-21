import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import ErrorBoundary from "./ErrorBoundary.jsx"

function Boom({ explode }) {
  if (explode) throw new Error("kaboom")
  return <p>fine</p>
}

describe("ErrorBoundary", () => {
  it("shows a recoverable message instead of a blank page", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const reload = vi.fn()
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload })

    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Boom explode />
      </ErrorBoundary>,
    )
    expect(screen.getByRole("alert")).toHaveTextContent("pageErrorTitle")
    fireEvent.click(screen.getByRole("button", { name: "reloadPage" }))
    expect(reload).toHaveBeenCalled()

    // Same key: the error stays until the user navigates.
    rerender(
      <ErrorBoundary resetKey="/a">
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole("alert")).toBeInTheDocument()

    rerender(
      <ErrorBoundary resetKey="/b">
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText("fine")).toBeInTheDocument()
  })
})
