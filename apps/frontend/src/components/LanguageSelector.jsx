import React, { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, Globe, Loader } from "lucide-react"
import { getSupportedLanguages, LANGUAGE_MAP } from "../lib/translationService"
import "../styles/LanguageSelector.css"

function LanguageSelector({ onLanguageChange }) {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [languages] = useState(getSupportedLanguages())
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language)
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

      // Salvar preferência no localStorage
      localStorage.setItem("preferredLanguage", languageCode)

      // Chamar callback se fornecido
      if (onLanguageChange) {
        onLanguageChange(languageCode)
      }

      // Notificar usuário de sucesso
      console.log(`Idioma alterado para: ${LANGUAGE_MAP[languageCode]?.nativeName}`)
    } catch (error) {
      console.error("Erro ao alterar idioma:", error)
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
        title={`Idioma atual: ${currentLanguageName}`}
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
            <span>Selecionar Idioma</span>
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
