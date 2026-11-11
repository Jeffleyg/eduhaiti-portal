import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

vi.mock("./lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn(async () => ({})) }))

import App from "./App.jsx"
import * as adminModule from "./modules/admin/index.js"
import * as commonModule from "./modules/common/index.js"
import * as familyModule from "./modules/family/index.js"
import * as ownerModule from "./modules/owner/index.js"
import * as paymentsModule from "./modules/payments/index.js"
import * as professorModule from "./modules/professor/index.js"
import * as studentModule from "./modules/student/index.js"
import * as teacherModule from "./modules/teacher/index.js"

const visit = (path) => {
  window.history.pushState({}, "", path)
  return render(<App />)
}

beforeEach(() => {
  window.history.pushState({}, "", "/")
})

describe("App routing", () => {
  it("renders the landing page", () => {
    visit("/")
    expect(screen.getAllByText("brand").length).toBeGreaterThan(0)
  })

  it.each([
    ["/familia", "/family", "familyPortalTitle"],
    ["/pagamento-escolaridade", "/tuition-payment", "tuitionPaymentTitle"],
    ["/redeem-access", "/redeem-access", "continue"],
  ])("serves %s", async (path, expected, text) => {
    visit(path)
    await waitFor(() => expect(window.location.pathname).toBe(expected))
    expect(await screen.findAllByText(text)).not.toHaveLength(0)
  })

  it.each(["/professor", "/student/resultats", "/admin", "/owner", "/change-password"])(
    "sends anonymous visitors from %s to the login page",
    async (path) => {
      visit(path)
      await waitFor(() => expect(window.location.pathname).toBe("/login"))
    },
  )

  it("redirects unknown paths home", async () => {
    visit("/does-not-exist")
    await waitFor(() => expect(window.location.pathname).toBe("/"))
  })
})

describe("module barrels", () => {
  it("re-export page components", () => {
    for (const mod of [adminModule, commonModule, familyModule, ownerModule, paymentsModule, professorModule, studentModule, teacherModule]) {
      const exports = Object.values(mod)
      expect(exports.length).toBeGreaterThan(0)
      exports.forEach((component) => expect(typeof component).toBe("function"))
    }
    expect(studentModule.StudentGrades).toBe(studentModule.StudentResults)
  })
})
