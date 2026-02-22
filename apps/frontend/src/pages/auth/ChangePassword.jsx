import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { apiFetch } from "../../lib/api.js"
import { useAuth } from "../../context/AuthContext.jsx"

function ChangePassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { token, user, refreshProfile } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")
    setSuccess("")

    if (!currentPassword || !newPassword) {
      setError(t("passwordRequired"))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(t("passwordMismatch"))
      return
    }

    setLoading(true)
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        token,
        body: { currentPassword, newPassword },
      })
      await refreshProfile()
      setSuccess(t("passwordUpdated"))

      const role = user?.role
      if (role === "ADMIN") {
        navigate("/admin", { replace: true })
      } else if (role === "TEACHER") {
        navigate("/professor", { replace: true })
      } else {
        navigate("/student", { replace: true })
      }
    } catch (err) {
      setError(err.message || t("passwordUpdateFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-sand">
      <div className="pointer-events-none absolute inset-0 bg-atlas bg-grid opacity-60" />
      <div className="relative mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
        <div className="w-full rounded-3xl bg-white/90 p-8 shadow-xl shadow-brand-navy/10">
          <h1 className="font-display text-3xl text-brand-navy">{t("changePasswordTitle")}</h1>
          <p className="mt-2 text-sm text-brand-navy/70">{t("changePasswordSubtitle")}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                {t("currentPassword")}
              </label>
              <input
                className="mt-2 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm text-brand-navy outline-none"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                {t("newPassword")}
              </label>
              <input
                className="mt-2 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm text-brand-navy outline-none"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                {t("confirmPassword")}
              </label>
              <input
                className="mt-2 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm text-brand-navy outline-none"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>

            {error ? <p className="text-xs text-brand-red">{error}</p> : null}
            {success ? <p className="text-xs text-emerald-600">{success}</p> : null}

            <button className="primary-button w-full" type="submit" disabled={loading}>
              {loading ? t("loading") : t("changePasswordAction")}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ChangePassword
