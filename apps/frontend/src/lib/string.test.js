import { describe, expect, it, vi } from "vitest"
import sanitizeText, { maskName, sanitizeText as named } from "./string.js"

describe("sanitizeText", () => {
  it("returns empty string for null/undefined", () => {
    expect(sanitizeText(null)).toBe("")
    expect(sanitizeText(undefined)).toBe("")
  })

  it("trims, strips tags and control chars, collapses whitespace", () => {
    expect(named("  <b>Hi</b>\u0007   there  ")).toBe("Hi there")
  })

  it("converts non-strings", () => {
    expect(sanitizeText(42)).toBe("42")
  })

  it("truncates to default max of 200 with ellipsis", () => {
    const out = sanitizeText("a".repeat(300))
    expect(out).toHaveLength(200)
    expect(out.endsWith("…")).toBe(true)
  })

  it("honours a custom max", () => {
    expect(sanitizeText("abcdef", { max: 4 })).toBe("abc…")
    expect(sanitizeText("abc", { max: 4 })).toBe("abc")
  })

  it("survives environments where normalize throws", () => {
    const spy = vi.spyOn(String.prototype, "normalize").mockImplementation(() => {
      throw new Error("unsupported")
    })
    expect(sanitizeText(" x ")).toBe("x")
    spy.mockRestore()
  })
})

describe("maskName", () => {
  it("returns '-' for empty values", () => {
    expect(maskName(null)).toBe("-")
    expect(maskName(undefined)).toBe("-")
    expect(maskName("   ")).toBe("-")
  })

  it("maps known roles case-insensitively", () => {
    expect(maskName("Ana", "STUDENT")).toBe("Aluno")
    expect(maskName("Ana", "teacher")).toBe("Professor")
    expect(maskName("Ana", "guardian")).toBe("Responsável")
    expect(maskName("Ana", "parent")).toBe("Responsável")
    expect(maskName("Ana", "user")).toBe("Usuário")
  })

  it("returns a custom label when not a known role", () => {
    expect(maskName("Ana", "Diretora")).toBe("Diretora")
  })

  it("falls back to default label without a role", () => {
    expect(maskName("Ana")).toBe("Usuário")
    expect(maskName("Ana", 123)).toBe("Usuário")
  })
})
