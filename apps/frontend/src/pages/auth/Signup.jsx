import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiFetch } from "../../lib/api.js"
import { useTranslation } from "react-i18next"

function Signup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ email: "", name: "", role: "STUDENT" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const result = await apiFetch("/auth/signup", {
        method: "POST",
        body: formData,
      })

      if (result && result.id) {
        navigate("/login")
      }
    } catch (err) {
      setError(err.message || "Failed to create account")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy to-brand-sky flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
        <h1 className="text-3xl font-bold text-white mb-2">{t("signup")}</h1>
        <p className="text-sky-100 mb-6">{t("createAccountToGetStarted")}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sky-100 text-sm font-semibold mb-2">{t("email")}</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-brand-red"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sky-100 text-sm font-semibold mb-2">{t("fullName")}</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-brand-red"
              placeholder={t("enterYourName")}
            />
          </div>

          <div>
            <label className="block text-sky-100 text-sm font-semibold mb-2">{t("role")}</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-brand-red"
            >
              <option value="STUDENT" className="bg-brand-navy">{t("student")}</option>
              <option value="TEACHER" className="bg-brand-navy">{t("teacher")}</option>
            </select>
          </div>

          {error && <div className="text-brand-red text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3 bg-gradient-to-r from-brand-red to-brand-red hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
          >
            {loading ? t("creating") : t("createAccount")}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-sky-100">
            {t("alreadyHaveAccount")}{" "}
            <a href="/login" className="text-brand-red font-semibold hover:underline">
              {t("loginHere")}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Signup
