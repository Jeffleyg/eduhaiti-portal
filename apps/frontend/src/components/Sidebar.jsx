import React, { useState } from "react"
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  ListChecks,
  GraduationCap,
  LayoutDashboard,
  Mail,
  MessageSquare,
  HandCoins,
  Settings,
  UploadCloud,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
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
  { to: "/professor/forum", icon: MessageSquare, labelKey: "Forum" },
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
  { to: "/student/forum", icon: MessageSquare, labelKey: "Forum" },
  { to: "/student/messages", icon: Mail, labelKey: "navMessages" },
  { to: "/student/academic-requests", icon: FileCheck2, labelKey: "navAcademicRequests" },
]

const adminNav = [
  { to: "/admin", icon: Users, labelKey: "navUsers" },
  { to: "/admin/profile", icon: Settings, labelKey: "navProfile" },
  { to: "/admin/students", icon: GraduationCap, labelKey: "adminStudents" },
  { to: "/admin/classes", icon: CalendarDays, labelKey: "adminClasses" },
  { to: "/admin/disciplines", icon: BookOpen, labelKey: "adminDisciplines" },
  { to: "/admin/finance", icon: HandCoins, labelKey: "navFinance" },
  { to: "/admin/family-communication", icon: Mail, labelKey: "navFamilyCommunication" },
  { to: "/admin/academic", icon: Settings, labelKey: "navAcademicAdmin" },
  { to: "/admin/academic-requests", icon: ListChecks, labelKey: "navAcademicRequestsReview" },
]

const ownerNav = [
  { to: "/owner", icon: LayoutDashboard, labelKey: "Painel de Controle" },
  { to: "/owner/profile", icon: Settings, labelKey: "navProfile" },
]

function Sidebar({ role }) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const { logout } = useAuth()
  const navItems = role === "owner" ? ownerNav : role === "admin" ? adminNav : role === "professor" ? professorNav : studentNav

  const handleLogout = async () => {
    await logout()
    navigate("/login", { replace: true })
  }

  return (
    <aside
      className={`glass-panel sticky top-6 hidden h-[calc(100vh-3rem)] flex-col gap-5 overflow-hidden rounded-3xl px-4 py-5 lg:flex ${
        collapsed ? "w-16" : "w-64 xl:w-72"
      }`}
    >
      <div className="shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/LogoEdu.png"
            alt={t("brand")}
            className={`h-10 w-auto rounded-xl border border-brand-navy/10 bg-white px-2 py-1 ${collapsed ? "" : ""}`}
          />
          {!collapsed ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red/60">{t("appSubtitle")}</p>
              <h2 className="mt-1 font-display text-xl text-brand-navy">{t("brand")}</h2>
              <p className="mt-1 text-sm text-brand-navy/70">{t("role" + role)}</p>
            </div>
          ) : null}
        </div>

        <button
          onClick={() => setCollapsed((s) => !s)}
          className="rounded-full p-1 text-brand-navy/70 hover:bg-white"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1 pt-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/professor" || item.to === "/student"}
            title={t(item.labelKey)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? "bg-brand-navy text-white shadow-md shadow-brand-navy/20" : "text-brand-navy/70 hover:bg-white"
              } ${collapsed ? "justify-center px-0" : ""}`
            }
          >
            <item.icon className="h-4 w-4" />
            {!collapsed ? t(item.labelKey) : null}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-brand-navy/70 transition-colors hover:bg-brand-red/10 hover:text-brand-red ${
            collapsed ? "justify-center" : ""
          }`}
          title={t("logout")}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed ? t("logout") : null}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
