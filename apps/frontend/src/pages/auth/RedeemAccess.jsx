import { ArrowRight, CheckCircle, AlertCircle } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { apiFetch } from "../../lib/api.js"

function RedeemAccess() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const code = searchParams.get("code")

  const [step, setStep] = useState(code ? "info" : "code")
  const [form, setForm] = useState({
    code: code || "",
    email: "",
    name: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(null)

  if (!code) {
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
                <p className="text-xs font-bold uppercase tracking-wider text-brand-red/60">
                  Sistema de Educação
                </p>
                <h1 className="text-xl font-bold text-brand-navy">EduHaiti Portal</h1>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative flex min-h-[calc(100vh-70px)] items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="rounded-3xl border border-brand-navy/10 bg-white/90 p-8 shadow-xl shadow-brand-navy/10">
              <div className="mb-8 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red/60">
                  Acesso à Escola
                </p>
                <h1 className="mt-2 text-3xl font-bold text-brand-navy">
                  Entre com seu Código
                </h1>
                <p className="mt-2 text-sm text-brand-navy/70">
                  O diretor compartilhou um código de acesso com você
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setStep("info")
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                    Código de Permissão
                  </label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-brand-navy/10 bg-sand px-4 py-3 font-mono text-sm font-bold uppercase text-brand-navy placeholder-brand-navy/40 outline-none focus:border-brand-navy/30 focus:bg-sand/80 transition-all"
                    placeholder="XXXXXXXX"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-brand-navy py-3 font-semibold text-white hover:bg-brand-navy/90 transition-all flex items-center justify-center gap-2"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handleRedeem = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await apiFetch("/owner-auth/verify-permission-code", {
        method: "POST",
        body: {
          code: form.code,
          email: form.email,
          name: form.name || undefined,
        },
      })

      setSuccess(response)
      setTimeout(() => {
        navigate("/login", {
          state: { email: form.email },
        })
      }, 2000)
    } catch (err) {
      setError(err.message || t("invalidOrExpiredCode"))
    } finally {
      setLoading(false)
    }
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
              <p className="text-xs font-bold uppercase tracking-wider text-brand-red/60">
                Sistema de Educação
              </p>
              <h1 className="text-xl font-bold text-brand-navy">EduHaiti Portal</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative flex min-h-[calc(100vh-70px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {success ? (
            <div className="rounded-3xl border border-green-200 bg-green-50 p-8 shadow-xl shadow-green-100">
              <div className="text-center">
                <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
                <h1 className="text-2xl font-bold text-green-900 mb-2">Bem-vindo!</h1>
                <p className="text-sm text-green-800 mb-4">
                  Sua conta foi criada com sucesso em <strong>{success.schoolName}</strong>
                </p>
                <p className="text-xs text-green-700">
                  Redirecionando para login...
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-brand-navy/10 bg-white/90 p-8 shadow-xl shadow-brand-navy/10">
              <div className="mb-8 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red/60">
                  Novo Usuário
                </p>
                <h1 className="mt-2 text-3xl font-bold text-brand-navy">
                  Criar Conta Escolar
                </h1>
                <p className="mt-2 text-sm text-brand-navy/70">
                  Complete seus dados para acessar <strong>{success?.schoolName}</strong>
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-2xl border border-brand-red/20 bg-brand-red/5 p-4 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-brand-red flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-brand-red">{error}</p>
                </div>
              )}

              <form onSubmit={handleRedeem} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                    Nome Completo
                  </label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-brand-navy/10 bg-sand px-4 py-3 text-sm text-brand-navy placeholder-brand-navy/40 outline-none focus:border-brand-navy/30 focus:bg-sand/80 transition-all"
                    placeholder="Seu nome completo"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                    Email
                  </label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-brand-navy/10 bg-sand px-4 py-3 text-sm text-brand-navy placeholder-brand-navy/40 outline-none focus:border-brand-navy/30 focus:bg-sand/80 transition-all"
                    type="email"
                    placeholder="seu@email.ht"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>

                {/* Code (hidden, pre-filled) */}
                <input type="hidden" value={form.code} />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-brand-navy py-3 font-semibold text-white hover:bg-brand-navy/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? "Criando Conta..." : "Criar Conta"}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-brand-navy/50">
                Já possui uma conta?{" "}
                <button
                  onClick={() => navigate("/login")}
                  className="text-brand-navy font-semibold hover:underline"
                >
                  Faça login
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RedeemAccess
