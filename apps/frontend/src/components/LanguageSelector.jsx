import React, { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, Globe, Loader } from "lucide-react"
import { getSupportedLanguages, LANGUAGE_MAP } from "../lib/translationService"
import "../styles/LanguageSelector.css"

function LanguageSelector({ onLanguageChange }) {
  const { i18n, t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  // Only allow French and Haitian Creole as selectable languages
  const allowed = ["fr", "ht"]
  const allowedLanguages = getSupportedLanguages().filter((l) => allowed.includes(l.code))
  const [languages] = useState(allowedLanguages)

  const initialPreferred =
    (typeof localStorage !== "undefined" && localStorage.getItem("preferredLanguage")) ||
    i18n.language ||
    "fr"

  const [selectedLanguage, setSelectedLanguage] = useState(initialPreferred)
  const dropdownRef = useRef(null)

  const currentLanguageName =
    LANGUAGE_MAP[selectedLanguage]?.nativeName || selectedLanguage

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Atualizar quando o i18n muda externamente
  useEffect(() => {
    setSelectedLanguage(i18n.language)
  }, [i18n.language])

  // Ensure i18n is using the selected language on mount
  useEffect(() => {
    if (i18n.language !== selectedLanguage) {
      i18n.changeLanguage(selectedLanguage).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLanguageSelect = async (languageCode) => {
    if (languageCode === selectedLanguage) {
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    setIsOpen(false)

    try {
      // Mudar o idioma no i18next
      await i18n.changeLanguage(languageCode)
      setSelectedLanguage(languageCode)

      // Save language preference in localStorage
      localStorage.setItem("preferredLanguage", languageCode)

      // Call callback if provided
      if (onLanguageChange) {
        onLanguageChange(languageCode)
      }

      // Notify user of success
      console.log(`Language changed to: ${LANGUAGE_MAP[languageCode]?.nativeName}`)
    } catch (error) {
      console.error("Failed to change language:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="language-selector-wrapper" ref={dropdownRef}>
      <button
        className="language-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        disabled={isLoading}
        title={`${t("languageLabel")}: ${currentLanguageName}`}
      >
        {isLoading ? (
          <Loader className="h-4 w-4 animate-spin" />
        ) : (
          <Globe className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">{currentLanguageName}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && !isLoading && (
        <div className="language-selector-dropdown">
          <div className="language-selector-header">
            <Globe className="h-4 w-4" />
            <span>{t("selectLanguage")}</span>
          </div>

          <div className="language-selector-scroll">
            {languages.map((lang) => (
              <button
                key={lang.code}
                className={`language-selector-item ${
                  selectedLanguage === lang.code ? "active" : ""
                }`}
                onClick={() => handleLanguageSelect(lang.code)}
                type="button"
              >
                <span className="language-name">{lang.nativeName}</span>
                <span className="language-code">({lang.code})</span>
                {selectedLanguage === lang.code && (
                  <span className="language-check">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default LanguageSelector
