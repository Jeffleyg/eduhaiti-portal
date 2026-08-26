import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import frTranslation from "./locales/fr.json"
import htTranslation from "./locales/ht.json"

const resources = {
  fr: { translation: frTranslation },
  ht: { translation: htTranslation },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // Default site language set to French. Only French and Haitian Creole are supported.
    lng: "fr",
    fallbackLng: "fr",
    supportedLngs: ["fr", "ht"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      // Prefer explicit user selection saved in localStorage; navigator fallback
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  })

export default i18n
