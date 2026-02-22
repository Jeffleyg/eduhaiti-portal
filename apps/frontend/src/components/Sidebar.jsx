import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Mail,
  UploadCloud,
  Users,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import { useTranslation } from "react-i18next"

const professorNav = [
  { to: "/professor", icon: LayoutDashboard, labelKey: "navOverview" },
  { to: "/professor/notes", icon: GraduationCap, labelKey: "navGrades" },
  { to: "/professor/presence", icon: ClipboardCheck, labelKey: "navAttendance" },
  { to: "/professor/ressources", icon: UploadCloud, labelKey: "navResources" },
  { to: "/professor/tarefas", icon: BookOpen, labelKey: "Tarefas" },
  { to: "/professor/messages", icon: Mail, labelKey: "navMessages" },
]

const studentNav = [
  { to: "/student", icon: LayoutDashboard, labelKey: "navOverview" },
  { to: "/student/resultats", icon: BookOpen, labelKey: "navResults" },
  { to: "/student/horaire", icon: CalendarDays, labelKey: "navSchedule" },
  { to: "/student/ressources", icon: UploadCloud, labelKey: "navResources" },
  { to: "/student/tarefas", icon: ClipboardCheck, labelKey: "Tarefas" },
  { to: "/student/messages", icon: Mail, labelKey: "navMessages" },
]

const adminNav = [{ to: "/admin", icon: Users, labelKey: "navUsers" }]

function Sidebar({ role }) {
  const { t } = useTranslation()
  const navItems = role === "admin" ? adminNav : role === "professor" ? professorNav : studentNav

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
    </aside>
  )
}

export default Sidebar
