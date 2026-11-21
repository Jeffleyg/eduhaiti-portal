import { ArrowLeft, KeyRound, Mail, MailCheck } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import AuthCardLayout from "../../components/auth/AuthCardLayout.jsx"
import { apiFetch } from "../../lib/api.js"

// Matches the backend: one link per account per minute.
const RESEND_DELAY_SECONDS = 60

function ForgotPassword() {
  const { t } = useTranslation()
  const location = useLocation()
  const [email, setEmail] = useState(location.state?.email ?? "")
  const [sentTo, setSentTo] = useState("")
  const [devResetUrl, setDevResetUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const sendLink = async (target) => {
    setLoading(true)
    setError("")
    try {
      const response = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: { email: target.trim() },
      })
      setSentTo(target.trim())
      setDevResetUrl(response?.devResetUrl ?? "")
      setCooldown(RESEND_DELAY_SECONDS)
    } catch (err) {
      setError(err.message.includes("email must be an email") ? t("invalidEmail") : t("serverError"))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!email.trim()) {
      setError(t("emailRequired"))
      return
    }
    sendLink(email)
  }

  const footer = (
    <Link to="/login" className="inline-flex items-center gap-2 font-semibold text-brand-navy hover:underline">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {t("backToLogin")}
    </Link>
  )

  if (sentTo) {
    return (
      <AuthCardLayout icon={MailCheck} tone="success" title={t("resetLinkSentTitle")} footer={footer}>
        <div className="space-y-5">
          <p role="status" className="text-center text-sm leading-6 text-brand-navy/75">
            {t("resetLinkSentText", { email: sentTo })}
          </p>

          {devResetUrl ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p>{t("devResetLinkLabel")}</p>
              <a href={devResetUrl} className="mt-2 inline-block font-semibold underline">
                {t("openResetLink")}
              </a>
            </div>
          ) : null}

          <button
            type="button"
            className="primary-button w-full"
            disabled={cooldown > 0 || loading}
            onClick={() => sendLink(sentTo)}
          >
            {loading ? t("loading") : cooldown > 0 ? t("resendLinkIn", { seconds: cooldown }) : t("resendLink")}
          </button>
          <button
            type="button"
            className="w-full text-sm font-semibold text-brand-navy/70 hover:text-brand-navy hover:underline"
            onClick={() => {
              setSentTo("")
              setDevResetUrl("")
            }}
          >
            {t("useAnotherEmail")}
          </button>

          {error ? (
            <p role="alert" className="text-center text-sm text-brand-red">
              {error}
            </p>
          ) : null}
          <p className="border-t border-brand-navy/10 pt-4 text-center text-xs leading-5 text-brand-navy/60">
            {t("noEmailAccessHint")}
          </p>
        </div>
      </AuthCardLayout>
    )
  }

  return (
    <AuthCardLayout
      icon={KeyRound}
      title={t("forgotPasswordTitle")}
      subtitle={t("forgotPasswordSubtitle")}
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="forgot-email" className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
            {t("email")}
          </label>
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-brand-navy/10 bg-sand px-4 py-3 transition-all focus-within:border-brand-navy/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-sky/30">
            <Mail className="h-5 w-5 text-brand-navy/60" aria-hidden="true" />
            <input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="username"
              aria-required="true"
              autoFocus
              className="flex-1 bg-transparent text-sm text-brand-navy placeholder-brand-navy/40 outline-none"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </div>

        {error ? (
          <div role="alert" className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">
            {error}
          </div>
        ) : null}

        <button className="primary-button w-full" type="submit" disabled={loading}>
          {loading ? t("loading") : t("sendResetLink")}
        </button>

        <p className="text-center text-xs leading-5 text-brand-navy/60">{t("noEmailAccessHint")}</p>
      </form>
    </AuthCardLayout>
  )
}

export default ForgotPassword
