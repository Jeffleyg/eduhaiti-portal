import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import ptTranslation from "./locales/pt.json"
import frTranslation from "./locales/fr.json"
import htTranslation from "./locales/ht.json"

const resources = {
  pt: {
    translation: ptTranslation,
  },
  fr: {
    translation: frTranslation,
  },
  ht: {
    translation: htTranslation,
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "fr",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  })

export default i18n
