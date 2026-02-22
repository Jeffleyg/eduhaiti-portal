import { Lock, Mail } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { apiFetch } from "../../lib/api.js"
import { useAuth } from "../../context/AuthContext.jsx"

function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async () => {
    if (!email) {
      setError(t("emailRequired"))
      return
    }

    if (!password) {
      setError(t("passwordRequired"))
      return
    }

    setLoading(true)
    setError("")
    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, password },
      })
      login(response.token, response.user)

      if (response.user?.mustChangePassword) {
        navigate("/change-password", { replace: true })
        return
      }

      const role = response.user?.role
      if (role === "ADMIN") {
        navigate("/admin", { replace: true })
      } else if (role === "TEACHER") {
        navigate("/professor", { replace: true })
      } else {
        navigate("/student", { replace: true })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-sand">
      <div className="pointer-events-none absolute inset-0 bg-atlas bg-grid opacity-60" />
      <div className="relative mx-auto flex min-h-screen max-w-4xl items-center px-6 py-12">
        <div className="grid w-full gap-8 rounded-3xl bg-white/90 p-8 shadow-xl shadow-brand-navy/10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red/60">
              {t("login")}
            </p>
            <h1 className="font-display text-3xl text-brand-navy">{t("loginTitle")}</h1>
            <p className="text-sm text-brand-navy/70">{t("loginSubtitle")}</p>

            <div className="mt-6 space-y-4 rounded-2xl border border-brand-navy/10 bg-white px-4 py-5">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                {t("email")}
              </label>
              <div className="flex items-center gap-3 rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2">
                <Mail className="h-4 w-4 text-brand-navy/60" />
                <input
                  className="w-full bg-transparent text-sm text-brand-navy outline-none"
                  placeholder="ex: nom@ecole.ht"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                {t("password")}
              </label>
              <div className="flex items-center gap-3 rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2">
                <Lock className="h-4 w-4 text-brand-navy/60" />
                <input
                  className="w-full bg-transparent text-sm text-brand-navy outline-none"
                  placeholder="********"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <button
                className="primary-button w-full"
                type="button"
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? t("loading") : t("login")}
              </button>
              {error ? <p className="text-xs text-brand-red">{error}</p> : null}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-6 rounded-3xl bg-brand-navy px-6 py-6 text-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">{t("securityTitle")}</p>
              <h2 className="mt-3 text-2xl font-semibold">{t("securityCopy")}</h2>
              <p className="mt-2 text-sm text-white/70">{t("communityCopy")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
