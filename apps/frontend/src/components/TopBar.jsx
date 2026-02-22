import { Globe } from "lucide-react"
import { useTranslation } from "react-i18next"

function TopBar({ role }) {
  const { t, i18n } = useTranslation()
  const currentLanguage = i18n.resolvedLanguage || i18n.language
  const nextLanguage = currentLanguage === "fr" ? "ht" : "fr"

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white/80 px-5 py-4 shadow-lg shadow-brand-navy/5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red/60">
          {t("dashboardTitle")}
        </p>
        <h1 className="text-2xl font-semibold text-brand-navy">{t("role" + role)}</h1>
      </div>
      <button
        className="inline-flex items-center gap-2 rounded-full border border-brand-navy/20 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy"
        type="button"
        onClick={() => i18n.changeLanguage(nextLanguage)}
      >
        <Globe className="h-4 w-4" />
        {t("languageSwitch")}
      </button>
    </div>
  )
}

export default TopBar
