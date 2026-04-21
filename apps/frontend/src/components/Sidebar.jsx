import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  ListChecks,
  GraduationCap,
  LayoutDashboard,
  Mail,
  Settings,
  UploadCloud,
  Users,
  LogOut,
} from "lucide-react"
import { NavLink, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "../context/AuthContext.jsx"

const professorNav = [
  { to: "/professor", icon: LayoutDashboard, labelKey: "navOverview" },
  { to: "/professor/profile", icon: Users, labelKey: "navProfile" },
  { to: "/professor/notes", icon: GraduationCap, labelKey: "navGrades" },
  { to: "/professor/presence", icon: ClipboardCheck, labelKey: "navAttendance" },
  { to: "/professor/ressources", icon: UploadCloud, labelKey: "navResources" },
  { to: "/professor/tarefas", icon: BookOpen, labelKey: "Tarefas" },
  { to: "/professor/messages", icon: Mail, labelKey: "navMessages" },
  { to: "/professor/academic-requests", icon: ListChecks, labelKey: "navAcademicRequestsReview" },
]

const studentNav = [
  { to: "/student", icon: LayoutDashboard, labelKey: "navOverview" },
  { to: "/student/profile", icon: Users, labelKey: "navProfile" },
  { to: "/student/resultats", icon: BookOpen, labelKey: "navResults" },
  { to: "/student/horaire", icon: CalendarDays, labelKey: "navSchedule" },
  { to: "/student/ressources", icon: UploadCloud, labelKey: "navResources" },
  { to: "/student/tarefas", icon: ClipboardCheck, labelKey: "Tarefas" },
  { to: "/student/messages", icon: Mail, labelKey: "navMessages" },
  { to: "/student/academic-requests", icon: FileCheck2, labelKey: "navAcademicRequests" },
]

const adminNav = [
  { to: "/admin", icon: Users, labelKey: "navUsers" },
  { to: "/admin/profile", icon: Settings, labelKey: "navProfile" },
  { to: "/admin/students", icon: GraduationCap, labelKey: "adminStudents" },
  { to: "/admin/classes", icon: CalendarDays, labelKey: "adminClasses" },
  { to: "/admin/disciplines", icon: BookOpen, labelKey: "adminDisciplines" },
  { to: "/admin/academic", icon: Settings, labelKey: "navAcademicAdmin" },
  { to: "/admin/academic-requests", icon: ListChecks, labelKey: "navAcademicRequestsReview" },
]

function Sidebar({ role }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const navItems = role === "admin" ? adminNav : role === "professor" ? professorNav : studentNav

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  return (
    <aside className="glass-panel hidden w-64 flex-col gap-6 rounded-3xl px-5 py-6 lg:flex">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red/60">
          {t("appSubtitle")}
        </p>
        <h2 className="mt-2 font-display text-2xl text-brand-navy">{t("brand")}</h2>
        <p className="mt-2 text-sm text-brand-navy/70">{t("role" + role)}</p>
      </div>

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/professor" || item.to === "/student"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-brand-navy text-white" : "text-brand-navy/70 hover:bg-white"
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-brand-navy/70 transition-colors hover:bg-brand-red/10 hover:text-brand-red mt-auto"
      >
        <LogOut className="h-4 w-4" />
        {t("logout")}
      </button>
    </aside>
  )
}

export default Sidebar
