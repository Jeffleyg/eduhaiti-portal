import { Check, CircleCheck, Eye, EyeOff, Link2Off, LockKeyhole, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import AuthCardLayout from "../../components/auth/AuthCardLayout.jsx"
import { apiFetch } from "../../lib/api.js"
import { passwordChecks, passwordStrength } from "../../lib/password.js"

const TOKEN_PATTERN = /^[0-9a-f]{64}$/

const STRENGTH = [
  null,
  { key: "passwordStrengthWeak", bar: "bg-brand-red", width: "w-1/3" },
  { key: "passwordStrengthMedium", bar: "bg-amber-500", width: "w-2/3" },
  { key: "passwordStrengthStrong", bar: "bg-emerald-500", width: "w-full" },
]

function Rule({ ok, label }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-emerald-700" : "text-brand-navy/55"}`}>
      {ok ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{label}</span>
    </li>
  )
}

function ResetPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [status, setStatus] = useState(TOKEN_PATTERN.test(token) ? "checking" : "invalid")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (status !== "checking") return undefined
    let active = true
    apiFetch("/auth/reset-password/check", { method: "POST", body: { token } })
      .then((result) => active && setStatus(result?.valid ? "ready" : "invalid"))
      // If the check itself fails (offline...), still let the user try: submit reports the real error.
      .catch(() => active && setStatus("ready"))
    return () => {
      active = false
    }
  }, [status, token])

  const checks = passwordChecks(password, confirmation)
  const strength = STRENGTH[passwordStrength(password)]

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!checks.length) {
      setError(t("passwordRuleLength"))
      return
    }
    if (!checks.match) {
      setError(t("passwordMismatch"))
      return
    }
    setLoading(true)
    setError("")
    try {
      await apiFetch("/auth/reset-password", { method: "POST", body: { token, newPassword: password } })
      setStatus("done")
    } catch (err) {
      if (err.message.includes("Invalid or expired reset link")) {
        setStatus("invalid")
      } else {
        setError(t("serverError"))
      }
    } finally {
      setLoading(false)
    }
  }

  if (status === "checking") {
    return (
      <AuthCardLayout icon={LockKeyhole} title={t("resetPasswordTitle")}>
        <p role="status" className="flex items-center justify-center gap-3 text-sm text-brand-navy/70">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-navy border-t-transparent" />
          {t("checkingResetLink")}
        </p>
      </AuthCardLayout>
    )
  }

  if (status === "invalid") {
    return (
      <AuthCardLayout icon={Link2Off} tone="danger" title={t("resetLinkInvalidTitle")} subtitle={t("resetLinkInvalidText")}>
        <div className="space-y-3">
          <Link to="/forgot-password" className="primary-button block w-full text-center">
            {t("requestNewLink")}
          </Link>
          <Link to="/login" className="block text-center text-sm font-semibold text-brand-navy/70 hover:text-brand-navy hover:underline">
            {t("backToLogin")}
          </Link>
        </div>
      </AuthCardLayout>
    )
  }

  if (status === "done") {
    return (
      <AuthCardLayout icon={CircleCheck} tone="success" title={t("passwordResetSuccessTitle")} subtitle={t("passwordResetSuccessText")}>
        <button
          type="button"
          className="primary-button w-full"
          onClick={() => navigate("/login", { replace: true, state: { notice: "passwordReset" } })}
        >
          {t("login")}
        </button>
      </AuthCardLayout>
    )
  }

  const inputType = showPassword ? "text" : "password"
  return (
    <AuthCardLayout icon={LockKeyhole} title={t("resetPasswordTitle")} subtitle={t("resetPasswordSubtitle")}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="reset-password" className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
            {t("newPassword")}
          </label>
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-brand-navy/10 bg-sand px-4 py-3 transition-all focus-within:border-brand-navy/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-sky/30">
            <input
              id="reset-password"
              name="new-password"
              type={inputType}
              autoComplete="new-password"
              aria-required="true"
              aria-describedby="reset-password-rules"
              autoFocus
              className="flex-1 bg-transparent text-sm text-brand-navy outline-none"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="rounded-lg p-1 text-brand-navy/60 hover:text-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky"
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          {strength ? (
            <div className="mt-2" aria-live="polite">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-navy/10">
                <div className={`h-full rounded-full transition-all ${strength.bar} ${strength.width}`} />
              </div>
              <p className="mt-1 text-xs text-brand-navy/60">{t("passwordStrength", { level: t(strength.key) })}</p>
            </div>
          ) : null}
        </div>

        <div>
          <label htmlFor="reset-confirm" className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
            {t("confirmPassword")}
          </label>
          <input
            id="reset-confirm"
            name="confirm-password"
            type={inputType}
            autoComplete="new-password"
            aria-required="true"
            className="mt-2 w-full rounded-2xl border border-brand-navy/10 bg-sand px-4 py-3 text-sm text-brand-navy outline-none transition-all focus:border-brand-navy/40 focus:bg-white focus:ring-2 focus:ring-brand-sky/30"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </div>

        <ul id="reset-password-rules" className="grid gap-1.5 rounded-2xl bg-brand-navy/5 p-4 text-xs">
          <Rule ok={checks.length} label={t("passwordRuleLength")} />
          <Rule ok={checks.mix} label={t("passwordRuleMix")} />
          <Rule ok={checks.symbol} label={t("passwordRuleSymbol")} />
          <Rule ok={checks.match} label={t("passwordRuleMatch")} />
        </ul>

        {error ? (
          <div role="alert" className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">
            {error}
          </div>
        ) : null}

        <button className="primary-button w-full" type="submit" disabled={loading}>
          {loading ? t("loading") : t("savePassword")}
        </button>
      </form>
    </AuthCardLayout>
  )
}

export default ResetPassword
