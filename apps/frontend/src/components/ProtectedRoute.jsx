import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext.jsx"

const ROLE_MAP = {
  professor: ["TEACHER", "ADMIN"],
  student: ["STUDENT", "ADMIN"],
  admin: ["ADMIN"],
}

function ProtectedRoute({ role }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand text-brand-navy">
        <p className="text-sm font-semibold uppercase tracking-[0.3em]">Loading</p>
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
