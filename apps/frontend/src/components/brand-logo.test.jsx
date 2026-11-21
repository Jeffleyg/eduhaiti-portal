import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import BrandLogo from "./BrandLogo.jsx"

describe("BrandLogo", () => {
  it.each([
    [{}, "/brand/eduhaiti-logo.svg"],
    [{ tone: "white" }, "/brand/eduhaiti-logo-white.svg"],
    [{ tone: "mono" }, "/brand/eduhaiti-logo-mono.svg"],
    [{ endorsed: true }, "/brand/eduhaiti-logo-nevvik.svg"],
    [{ endorsed: true, tone: "white" }, "/brand/eduhaiti-logo-nevvik-white.svg"],
    [{ variant: "stacked", tone: "white" }, "/brand/eduhaiti-logo-stacked-white.svg"],
    [{ variant: "mark" }, "/brand/eduhaiti-mark.svg"],
    [{ variant: "mark", tone: "mono" }, "/brand/eduhaiti-mark-mono.svg"],
    // The signature only exists on the horizontal logo; unknown values fall back.
    [{ variant: "mark", endorsed: true }, "/brand/eduhaiti-mark.svg"],
    [{ variant: "nope", tone: "nope" }, "/brand/eduhaiti-logo.svg"],
  ])("%j uses %s", (props, src) => {
    render(<BrandLogo {...props} />)
    expect(screen.getByAltText("EduHaiti")).toHaveAttribute("src", src)
  })

  it("takes a custom alt and size", () => {
    render(<BrandLogo alt="Accueil" className="h-12" />)
    const img = screen.getByAltText("Accueil")
    expect(img).toHaveClass("h-12")
    expect(img).toHaveAttribute("draggable", "false")
  })
})
