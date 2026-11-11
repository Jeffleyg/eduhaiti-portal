import "@testing-library/jest-dom/vitest"
import { afterEach, beforeAll, vi } from "vitest"
import { cleanup, configure } from "@testing-library/react"
import i18n from "../i18n.js"

// The full suite runs in parallel with coverage instrumentation, where a page can take
// longer than the default 1s to settle; give findBy*/waitFor more room.
configure({ asyncUtilTimeout: 4000 })

// "cimode" makes t("key") return the key itself, so assertions do not depend
// on the active language or on translation wording.
beforeAll(async () => {
  await i18n.changeLanguage("cimode")
})

// jsdom gaps used by Radix UI and some components
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.setPointerCapture = () => {}
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
})
