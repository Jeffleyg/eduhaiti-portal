import { LogOut, Settings, User } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext.jsx"
import { useTranslation } from "react-i18next"
import { sanitizeText, maskName } from "../lib/string.js"
import { useState } from "react"

function CorporateHeader() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  const roleLabelKey = user?.role === "TEACHER" ? "roleprofessor" : `role${user?.role}`

  const getProfilePath = () => {
    switch (user?.role) {
      case "ADMIN":
        return "/admin/profile"
      case "TEACHER":
        return "/teacher/profile"
      case "STUDENT":
        return "/student/profile"
      default:
        return "/profile"
    }
  }

  const getSettingsPath = () => {
    switch (user?.role) {
      case "STUDENT":
        return "/student/settings"
      case "ADMIN":
      case "TEACHER":
        return "/change-password"
      default:
        return "/change-password"
    }
  }

  const handleLogout = () => {
    logout()
    navigate("/", { replace: true })
  }

  const getRoleBadgeColor = () => {
    switch (user?.role) {
      case "ADMIN":
        return "bg-brand-red/10 text-brand-red"
      case "TEACHER":
        return "bg-brand-sky/10 text-brand-sky"
      case "STUDENT":
        return "bg-emerald-100 text-emerald-700"
      default:
        return "bg-brand-navy/10 text-brand-navy"
    }
  }

  return (
    <div className="sticky top-0 z-40 border-b border-white/10 bg-brand-navy/95 text-white shadow-lg shadow-brand-navy/20 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <img
            src="/LogoEdu.png"
            alt="EduHaiti"
            className="h-10 w-auto rounded-xl border border-white/15 bg-white/10 px-2 py-1"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">EduHaiti Portal</p>
            <p className="text-sm font-semibold text-white">{t(roleLabelKey)}</p>
          </div>
        </div>

        <div className="relative flex items-center gap-4">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
          >
              {user?.profilePhoto ? (
                <img
                  src={user.profilePhoto}
                  alt={maskName(user?.name, user?.role === "STUDENT" ? "student" : user?.role === "TEACHER" ? "teacher" : "user")}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
              <User className="h-5 w-5" />
            )}
            <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-brand-navy bg-emerald-400" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-brand-navy/10 bg-white/95 shadow-2xl shadow-brand-navy/15 backdrop-blur-sm">
              <div className="border-b border-brand-navy/10 px-4 py-3">
                <p className="font-semibold text-brand-navy">{maskName(user?.name, user?.role === "STUDENT" ? "student" : user?.role === "TEACHER" ? "teacher" : "user")}</p>
                <p className="text-xs text-brand-navy/60">{sanitizeText(user?.email)}</p>
                <div className="mt-2 flex gap-2">
                  <span className={`badge ${getRoleBadgeColor()}`}>
                    {t(roleLabelKey)}
                  </span>
                  {user?.enrollmentNumber && (
                    <span className="inline-block rounded-full bg-brand-navy/10 px-2 py-1 text-xs font-semibold text-brand-navy">
                      {user.enrollmentNumber}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1 p-2">
                <button
                  onClick={() => {
                    navigate(getProfilePath())
                    setShowMenu(false)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2 text-sm text-brand-navy transition-colors hover:bg-brand-navy/5"
                >
                  <User className="h-4 w-4" />
                  {t("profile")}
                </button>
                <button
                  onClick={() => {
                    navigate(getSettingsPath())
                    setShowMenu(false)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2 text-sm text-brand-navy transition-colors hover:bg-brand-navy/5"
                >
                  <Settings className="h-4 w-4" />
                  {t("settings")}
                </button>

                <div className="my-2 border-t border-brand-navy/10" />

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2 text-sm text-brand-red transition-colors hover:bg-brand-red/5"
                >
                  <LogOut className="h-4 w-4" />
                  {t("logout")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CorporateHeader
