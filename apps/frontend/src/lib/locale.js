import i18n from "../i18n.js"

const LOCALES = { pt: "pt-BR", fr: "fr-FR", ht: "fr-HT", en: "en-US" }

/**
 * Locale for dates and numbers that follows the language chosen in the UI
 * (instead of a fixed "pt-BR"). Unknown languages use the browser default.
 */
export function uiLocale() {
  const language = (i18n.resolvedLanguage || i18n.language || "").split("-")[0]
  return LOCALES[language]
}
