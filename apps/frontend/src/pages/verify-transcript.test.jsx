import { beforeEach, describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithRouter } from "../test/utils.jsx"

vi.mock("../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../lib/api.js"
import VerifyTranscript from "./VerifyTranscript.jsx"

const open = (id = "card-1") => renderWithRouter(<VerifyTranscript />, { route: `/verify-transcript/${id}`, path: "/verify-transcript/:id" })

beforeEach(() => {
  apiFetch.mockReset()
})

describe("VerifyTranscript", () => {
  it("confirms an authentic transcript", async () => {
    apiFetch.mockResolvedValue({
      valid: true,
      verificationHash: "abc123",
      scorecard: { averageScore: 13.5, passStatus: true },
      student: { name: "Ana Lima", enrollmentNumber: "2026-0001" },
      academicYear: { year: "2025-2026" },
    })
    open()
    expect(screen.getByText("verifyLoading")).toBeInTheDocument()
    expect(await screen.findByText("verifyAuthentic")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/public/scorecards/card-1/verify")
    expect(screen.getByText("Ana Lima")).toBeInTheDocument()
    expect(screen.getByText("verifyAverage 13.5/20")).toBeInTheDocument()
    expect(screen.getByText("verifyDecision verifyPassed")).toBeInTheDocument()
    expect(screen.getByText("verifyFingerprint abc123")).toBeInTheDocument()
  })

  it("shows fallbacks for partial data and a failed decision", async () => {
    apiFetch.mockResolvedValue({ valid: true, verificationHash: "h", scorecard: { averageScore: null, passStatus: false } })
    open()
    expect(await screen.findByText("verifyDecision verifyFailed")).toBeInTheDocument()
    expect(screen.getByText("verifyAverage -")).toBeInTheDocument()
    expect(screen.getByText("verifyEnrollment -")).toBeInTheDocument()
  })

  it.each([
    ["an unknown id", () => apiFetch.mockRejectedValue(new Error("Scorecard not found"))],
    ["a draft scorecard", () => apiFetch.mockResolvedValue({ valid: false })],
  ])("rejects %s", async (_label, arrange) => {
    arrange()
    open("x y")
    expect(await screen.findByRole("alert")).toHaveTextContent("verifyInvalid")
    expect(apiFetch.mock.calls[0][0]).toBe("/public/scorecards/x%20y/verify")
  })

  it("ignores answers arriving after leaving the page", async () => {
    let resolve
    apiFetch.mockImplementationOnce(() => new Promise((r) => (resolve = r)))
    const first = open()
    first.unmount()
    resolve({ valid: true })
    let reject
    apiFetch.mockImplementationOnce(() => new Promise((_, r) => (reject = r)))
    const second = open()
    second.unmount()
    reject(new Error("late"))
    await Promise.resolve()
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
