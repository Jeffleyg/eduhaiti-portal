/**
 * Serviço de tradução automática usando LibreTranslate
 * Oferece fallback para tradução offline e caching
 */

// Mapeamento de códigos de idioma ISO 639-1 para nomes completos
export const LANGUAGE_MAP = {
  af: { name: "Afrikaans", nativeName: "Afrikaans" },
  ar: { name: "Arabic", nativeName: "العربية" },
  bg: { name: "Bulgarian", nativeName: "Български" },
  bn: { name: "Bengali", nativeName: "বাংলা" },
  ca: { name: "Catalan", nativeName: "Català" },
  cs: { name: "Czech", nativeName: "Čeština" },
  cy: { name: "Welsh", nativeName: "Cymraeg" },
  da: { name: "Danish", nativeName: "Dansk" },
  de: { name: "German", nativeName: "Deutsch" },
  el: { name: "Greek", nativeName: "Ελληνικά" },
  en: { name: "English", nativeName: "English" },
  es: { name: "Spanish", nativeName: "Español" },
  et: { name: "Estonian", nativeName: "Eesti" },
  fa: { name: "Persian", nativeName: "فارسی" },
  fi: { name: "Finnish", nativeName: "Suomi" },
  fr: { name: "French", nativeName: "Français" },
  gu: { name: "Gujarati", nativeName: "ગુજરાતી" },
  he: { name: "Hebrew", nativeName: "עברית" },
  hi: { name: "Hindi", nativeName: "हिन्दी" },
  hr: { name: "Croatian", nativeName: "Hrvatski" },
  hu: { name: "Hungarian", nativeName: "Magyar" },
  id: { name: "Indonesian", nativeName: "Bahasa Indonesia" },
  it: { name: "Italian", nativeName: "Italiano" },
  ja: { name: "Japanese", nativeName: "日本語" },
  kn: { name: "Kannada", nativeName: "ಕನ್ನಡ" },
  ko: { name: "Korean", nativeName: "한국어" },
  lt: { name: "Lithuanian", nativeName: "Lietuvių" },
  lv: { name: "Latvian", nativeName: "Latviešu" },
  mk: { name: "Macedonian", nativeName: "Македонски" },
  ml: { name: "Malayalam", nativeName: "മലയാളം" },
  mr: { name: "Marathi", nativeName: "मराठी" },
  ne: { name: "Nepali", nativeName: "नेपाली" },
  nl: { name: "Dutch", nativeName: "Nederlands" },
  pa: { name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  pl: { name: "Polish", nativeName: "Polski" },
  pt: { name: "Portuguese", nativeName: "Português" },
  ro: { name: "Romanian", nativeName: "Română" },
  ru: { name: "Russian", nativeName: "Русский" },
  sk: { name: "Slovak", nativeName: "Slovenčina" },
  sl: { name: "Slovenian", nativeName: "Slovenščina" },
  so: { name: "Somali", nativeName: "Soomaali" },
  sq: { name: "Albanian", nativeName: "Shqip" },
  sv: { name: "Swedish", nativeName: "Svenska" },
  ta: { name: "Tamil", nativeName: "தமிழ்" },
  te: { name: "Telugu", nativeName: "తెలుగు" },
  tl: { name: "Tagalog", nativeName: "Tagalog" },
  tr: { name: "Turkish", nativeName: "Türkçe" },
  uk: { name: "Ukrainian", nativeName: "Українська" },
  ur: { name: "Urdu", nativeName: "اردو" },
  vi: { name: "Vietnamese", nativeName: "Tiếng Việt" },
  zh: { name: "Chinese (Simplified)", nativeName: "中文" },
  "zh-Hans": { name: "Chinese (Simplified)", nativeName: "简体中文" },
  "zh-Hant": { name: "Chinese (Traditional)", nativeName: "繁體中文" },
  ht: { name: "Haitian Creole", nativeName: "Kreyòl Ayisyen" },
}

// Ordem de idiomas favoritos (aparece primeiro no seletor)
export const FEATURED_LANGUAGES = [
  "en",
  "fr",
  "es",
  "pt",
  "ht",
  "de",
  "it",
  "ja",
  "zh",
  "ar",
]

/**
 * Traduz um texto usando Google Translate via API
 * @param {string} text - Texto a traduzir
 * @param {string} targetLanguage - Código do idioma alvo (ex: 'es', 'pt')
 * @param {string} sourceLanguage - Código do idioma origem (padrão: 'fr')
 * @returns {Promise<string>} - Texto traduzido
 */
export async function translateText(
  text,
  targetLanguage = "pt",
  sourceLanguage = "fr"
) {
  if (!text || text.trim().length === 0) {
    return text
  }

  // Se for o mesmo idioma, retornar o texto original
  if (sourceLanguage === targetLanguage) {
    return text
  }

  try {
    // Usar LibreTranslate API (serviço gratuito e open-source)
    const response = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: text,
        source: sourceLanguage === "auto" ? "auto" : sourceLanguage,
        target: targetLanguage,
      }),
    })

    if (!response.ok) {
      console.warn(
        `Tradução falhou (${response.status}): ${targetLanguage}`,
        text.substring(0, 50)
      )
      return text
    }

    const data = await response.json()
    return data.translatedText || text
  } catch (error) {
    console.warn("Erro na tradução automática:", error)
    // Retornar o texto original em caso de erro
    return text
  }
}

/**
 * Traduz um objeto inteiro de traduções (todas as chaves)
 * @param {Object} translationObject - Objeto com chaves de tradução
 * @param {string} targetLanguage - Código do idioma alvo
 * @param {string} sourceLanguage - Código do idioma origem
 * @returns {Promise<Object>} - Objeto traduzido
 */
export async function translateObject(
  translationObject,
  targetLanguage,
  sourceLanguage
) {
  const translated = {}

  for (const [key, value] of Object.entries(translationObject)) {
    if (typeof value === "string") {
      translated[key] = await translateText(value, targetLanguage, sourceLanguage)
    } else if (typeof value === "object" && value !== null) {
      translated[key] = await translateObject(
        value,
        targetLanguage,
        sourceLanguage
      )
    } else {
      translated[key] = value
    }
  }

  return translated
}

/**
 * Cache simples de tradução no localStorage
 */
export const translationCache = {
  get(key) {
    try {
      const cached = localStorage.getItem(`translation_cache_${key}`)
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  },

  set(key, value, expiresInHours = 24) {
    try {
      const data = {
        value,
        expires: Date.now() + expiresInHours * 60 * 60 * 1000,
      }
      localStorage.setItem(`translation_cache_${key}`, JSON.stringify(data))
    } catch {
      console.warn("Não foi possível cachear tradução")
    }
  },

  isExpired(key) {
    try {
      const cached = localStorage.getItem(`translation_cache_${key}`)
      if (!cached) return true

      const data = JSON.parse(cached)
      return Date.now() > data.expires
    } catch {
      return true
    }
  },

  clear() {
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith("translation_cache_"))
        .forEach((key) => localStorage.removeItem(key))
    } catch {
      console.warn("Não foi possível limpar cache de tradução")
    }
  },
}

/**
 * Obter todos os idiomas suportados ordenados
 * @returns {Array} - Array de idiomas com código e nome
 */
export function getSupportedLanguages() {
  const featured = FEATURED_LANGUAGES.filter((code) => LANGUAGE_MAP[code]).map(
    (code) => ({
      code,
      ...LANGUAGE_MAP[code],
    })
  )

  const others = Object.entries(LANGUAGE_MAP)
    .filter(([code]) => !FEATURED_LANGUAGES.includes(code))
    .map(([code, data]) => ({
      code,
      ...data,
    }))

  return [...featured, ...others]
}

/**
 * Obter código de idioma a partir de um nome
 */
export function getLanguageCode(languageName) {
  const entry = Object.entries(LANGUAGE_MAP).find(
    ([, data]) =>
      data.name.toLowerCase() === languageName.toLowerCase() ||
      data.nativeName === languageName
  )
  return entry ? entry[0] : null
}
