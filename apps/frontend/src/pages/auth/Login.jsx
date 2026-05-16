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
        navigate("/teacher", { replace: true })
      } else if (role === "OWNER") {
        navigate("/owner", { replace: true })
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

      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <section className="glass-panel fade-rise relative overflow-hidden rounded-[2rem] p-8 lg:p-10">
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-brand-red/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-brand-sky/10 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <img
              src="/LogoEdu.png"
              alt="EduHaiti"
              className="h-12 w-auto rounded-xl border border-brand-navy/10 bg-white px-2 py-1"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red/70">Sistema de Educação</p>
              <h1 className="font-display text-3xl text-brand-navy">EduHaiti Portal</h1>
            </div>
          </div>

          <div className="relative mt-10 max-w-xl space-y-5">
            <span className="chip">Gestão escolar centralizada</span>
            <h2 className="font-display text-4xl leading-tight text-brand-navy sm:text-5xl">
              Acesso elegante, seguro e direto para equipes educacionais.
            </h2>
            <p className="max-w-2xl text-base leading-7 text-brand-navy/75 sm:text-lg">
              Um portal pensado para escolas, administradores e professores entrarem rapidamente, com fluxo claro,
              onboarding por código e experiência consistente em todo o sistema.
            </p>
          </div>

          <div className="relative mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["Acesso rápido", "Login simples com recuperação do fluxo de entrada"],
              ["Perfil certo", "Cada pessoa cai automaticamente na área correta"],
              ["Base organizada", "Painéis com estrutura limpa e profissional"],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-brand-navy/10 bg-white/70 p-4 shadow-sm">
                <p className="text-sm font-semibold text-brand-navy">{title}</p>
                <p className="mt-1 text-sm leading-6 text-brand-navy/65">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-panel fade-rise rounded-[2rem] p-8 shadow-2xl shadow-brand-navy/10 lg:p-10">
          <div className="mb-8 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red/70">{t("welcomeBack")}</p>
            <h2 className="mt-2 font-display text-3xl text-brand-navy">{t("login")}</h2>
            <p className="mt-2 text-sm leading-6 text-brand-navy/70">{t("loginSubtitle")}</p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              handleLogin()
            }}
          >
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                {t("email")}
              </label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-brand-navy/10 bg-sand px-4 py-3 transition-all focus-within:border-brand-navy/30 focus-within:bg-sand/80">
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

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                {t("password")}
              </label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-brand-navy/10 bg-sand px-4 py-3 transition-all focus-within:border-brand-navy/30 focus-within:bg-sand/80">
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

            {error ? (
              <div className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">
                {error}
              </div>
            ) : null}

            <button className="primary-button w-full" type="submit" disabled={loading}>
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

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 border-t border-brand-navy/10" />
            <span className="text-xs font-semibold uppercase text-brand-navy/50">{t("or")}</span>
            <div className="flex-1 border-t border-brand-navy/10" />
          </div>

          {testAccounts.length > 0 ? (
            <div className="space-y-2">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">Contas de teste</p>
                <span className="rounded-full bg-brand-navy/5 px-3 py-1 text-xs font-semibold text-brand-navy/60">
                  Ambiente de validação
                </span>
              </div>
              {testAccounts.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  className="w-full rounded-2xl border border-brand-navy/10 bg-brand-navy/5 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-brand-navy/20 hover:bg-brand-navy/10"
                  onClick={() => runLogin(account.email, account.password)}
                  disabled={loading}
                >
                  <p className="text-sm font-semibold text-brand-navy">{account.role}</p>
                  <p className="text-xs text-brand-navy/70">{account.email}</p>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <div className="relative pb-8 text-center text-xs text-brand-navy/60">
        <p>Protected by enterprise security standards</p>
        <p className="mt-1">© 2025 EduHaiti. All rights reserved.</p>
      </div>
    </div>
  )
}

export default Login
