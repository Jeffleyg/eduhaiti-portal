import { Lock, Mail } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
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
  const [testAccounts, setTestAccounts] = useState([])

  const runLogin = async (nextEmail, nextPassword) => {
    setLoading(true)
    setError("")
    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        body: { email: nextEmail, password: nextPassword },
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
      if (err.message.includes("Unauthorized") || err.message.includes("401")) {
        setError(t("invalidCredentials"))
      } else if (err.message.includes("Request failed") || !err.message) {
        setError(t("serverError"))
      } else {
        setError(t("errorOccurred"))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadTestAccounts = async () => {
      try {
        const payload = await apiFetch("/auth/test-credentials")
        const accounts = [payload.admin, payload.teacher, payload.student].filter(Boolean)
        setTestAccounts(accounts)
      } catch {
        setTestAccounts([])
      }
    }

    loadTestAccounts()
  }, [])

  const handleLogin = async () => {
    if (!email) {
      setError(t("emailRequired"))
      return
    }

    if (!password) {
      setError(t("passwordRequired"))
      return
    }

    await runLogin(email, password)
  }

  return (
    <div className="min-h-screen bg-sand">
      <div className="pointer-events-none absolute inset-0 bg-atlas bg-grid opacity-60" />
      
      {/* Header */}
      <div className="relative border-b border-brand-navy/10 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img
              src="/LogoEdu.png"
              alt="EduHaiti"
              className="h-10 w-auto rounded border border-brand-navy/10 bg-white px-2 py-1"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-red/60">Sistema de Educação</p>
              <h1 className="text-xl font-bold text-brand-navy">EduHaiti Portal</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative flex min-h-[calc(100vh-70px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="rounded-3xl border border-brand-navy/10 bg-white/90 p-8 shadow-xl shadow-brand-navy/10">
            {/* Title */}
            <div className="mb-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red/60">
                {t("welcomeBack")}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-brand-navy">{t("login")}</h1>
              <p className="mt-2 text-sm text-brand-navy/70">{t("loginSubtitle")}</p>
            </div>

            {/* Form */}
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
              {/* Email Field */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                  {t("email")}
                </label>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-brand-navy/10 bg-sand px-4 py-3 focus-within:border-brand-navy/30 focus-within:bg-sand/80 transition-all">
                  <Mail className="h-5 w-5 text-brand-navy/60" />
                  <input
                    className="flex-1 bg-transparent text-sm text-brand-navy placeholder-brand-navy/40 outline-none"
                    placeholder="seu@email.ht"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                  {t("password")}
                </label>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-brand-navy/10 bg-sand px-4 py-3 focus-within:border-brand-navy/30 focus-within:bg-sand/80 transition-all">
                  <Lock className="h-5 w-5 text-brand-navy/60" />
                  <input
                    className="flex-1 bg-transparent text-sm text-brand-navy placeholder-brand-navy/40 outline-none"
                    placeholder="••••••••"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </div>

              {/* Error Message */}
              {error ? (
                <div className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">
                  {error}
                </div>
              ) : null}

              {/* Login Button */}
              <button
                className="primary-button w-full"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-navy border-t-transparent" />
                    {t("loading")}
                  </span>
                ) : (
                  t("login")
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 border-t border-brand-navy/10" />
              <span className="text-xs font-semibold text-brand-navy/50 uppercase">{t("or")}</span>
              <div className="flex-1 border-t border-brand-navy/10" />
            </div>

            {/* Test Accounts */}
            {testAccounts.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50 mb-3">
                  Contas de Teste
                </p>
                {testAccounts.map((account) => (
                  <button
                    key={account.role}
                    type="button"
                    className="w-full rounded-2xl border border-brand-navy/10 bg-brand-navy/5 px-4 py-3 text-left hover:bg-brand-navy/10 hover:border-brand-navy/20 transition-all"
                    onClick={() => runLogin(account.email, account.password)}
                    disabled={loading}
                  >
                    <p className="font-semibold text-brand-navy text-sm">{account.role}</p>
                    <p className="text-xs text-brand-navy/70">{account.email}</p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Footer Info */}
          <div className="mt-8 text-center text-xs text-brand-navy/60">
            <p>Protected by enterprise security standards</p>
            <p className="mt-1">© 2025 EduHaiti. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
