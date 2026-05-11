import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "../context/AuthContext.jsx"

const ROLE_MAP = {
  professor: ["TEACHER", "ADMIN"],
  student: ["STUDENT", "ADMIN"],
  admin: ["ADMIN"],
  owner: ["OWNER"],
}

function ProtectedRoute({ role }) {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand text-brand-navy">
        <p className="text-sm font-semibold uppercase tracking-[0.3em]">{t("loading")}</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />
  }

  const allowedRoles = ROLE_MAP[role] ?? []
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
