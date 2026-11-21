import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import BrandLogo from "../BrandLogo.jsx"

/** Centered card used by the public account pages (password recovery, etc.). */
function AuthCardLayout({ icon: Icon, tone = "navy", title, subtitle, children, footer }) {
  const { t } = useTranslation()
  const toneClass = {
    navy: "bg-brand-navy/10 text-brand-navy",
    success: "bg-emerald-100 text-emerald-700",
    danger: "bg-brand-red/10 text-brand-red",
  }[tone]

  return (
    <div className="relative min-h-screen bg-sand">
      <div className="pointer-events-none absolute inset-0 bg-atlas bg-grid opacity-60" />

      <header className="relative border-b border-brand-navy/10 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/login" className="flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky">
            <BrandLogo className="h-9" />
            <span className="hidden border-l border-brand-navy/15 pl-3 text-xs font-bold uppercase tracking-wider text-brand-red/60 sm:block">
              {t("educationSystem")}
            </span>
          </Link>
        </div>
      </header>

      <main className="relative flex min-h-[calc(100vh-73px)] items-center justify-center px-4 py-10">
        <div className="fade-rise w-full max-w-md">
          <div className="rounded-3xl border border-brand-navy/10 bg-white/90 p-6 shadow-xl shadow-brand-navy/10 sm:p-8">
            <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${toneClass}`}>
              <Icon className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="mb-6 text-center">
              <h1 className="font-display text-2xl text-brand-navy sm:text-3xl">{title}</h1>
              {subtitle ? <p className="mt-2 text-sm leading-6 text-brand-navy/70">{subtitle}</p> : null}
            </div>
            {children}
          </div>
          {footer ? <div className="mt-6 text-center text-sm text-brand-navy/70">{footer}</div> : null}
        </div>
      </main>
    </div>
  )
}

export default AuthCardLayout
