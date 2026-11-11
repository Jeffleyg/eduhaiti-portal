import { afterEach, describe, expect, it } from "vitest"
import i18n from "../i18n.js"
import { uiLocale } from "./locale.js"

afterEach(async () => {
  await i18n.changeLanguage("cimode")
})

describe("uiLocale", () => {
  it.each([
    ["pt", "pt-BR"],
    ["fr", "fr-FR"],
    ["ht", "fr-HT"],
    ["en", "en-US"],
  ])("maps %s to %s", async (language, locale) => {
    await i18n.changeLanguage(language)
    expect(uiLocale()).toBe(locale)
  })

  it("falls back to the browser default for unknown languages", async () => {
    await i18n.changeLanguage("cimode")
    expect(uiLocale()).toBeUndefined()
  })
})
