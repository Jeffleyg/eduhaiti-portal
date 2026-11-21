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
  NotebookPen,
  HandCoins,
  Settings,
  SlidersHorizontal,
  UploadCloud,
  UserRound,
  Users,
} from "lucide-react"

// Single source of truth for each role's menu: the Sidebar renders it and the
// TopBar uses it to show the title of the page the user is on.
export const professorNav = [
  { to: "/teacher", icon: LayoutDashboard, labelKey: "navOverview" },
  { to: "/teacher/grades", icon: GraduationCap, labelKey: "navGrades" },
  { to: "/teacher/attendance", icon: ClipboardCheck, labelKey: "navAttendance" },
  { to: "/teacher/assignments", icon: BookOpen, labelKey: "navHomework" },
  { to: "/teacher/resources", icon: UploadCloud, labelKey: "navResources" },
  { to: "/teacher/lesson-plans", icon: NotebookPen, labelKey: "lessonPlansTitle" },
  { to: "/teacher/forum", icon: MessageSquare, labelKey: "navForum" },
  { to: "/teacher/messages", icon: Mail, labelKey: "navMessages" },
  { to: "/teacher/academic-requests", icon: ListChecks, labelKey: "navAcademicRequestsReview" },
  { to: "/teacher/profile", icon: UserRound, labelKey: "navProfile" },
]

export const studentNav = [
  { to: "/student", icon: LayoutDashboard, labelKey: "navOverview" },
  { to: "/student/grades", icon: BookOpen, labelKey: "navResults" },
  { to: "/student/transcript", icon: GraduationCap, labelKey: "navTranscript" },
  { to: "/student/schedule", icon: CalendarDays, labelKey: "navSchedule" },
  { to: "/student/assignments", icon: ClipboardCheck, labelKey: "navHomework" },
  { to: "/student/resources", icon: UploadCloud, labelKey: "navResources" },
  { to: "/student/lesson-plans", icon: NotebookPen, labelKey: "lessonPlansTitle" },
  { to: "/student/forum", icon: MessageSquare, labelKey: "navForum" },
  { to: "/student/messages", icon: Mail, labelKey: "navMessages" },
  { to: "/student/academic-requests", icon: FileCheck2, labelKey: "navAcademicRequests" },
  { to: "/student/profile", icon: UserRound, labelKey: "navProfile" },
]

export const adminNav = [
  { to: "/admin", icon: LayoutDashboard, labelKey: "navOverview" },
  { to: "/admin/users", icon: Users, labelKey: "navUsers" },
  { to: "/admin/students", icon: GraduationCap, labelKey: "adminStudents" },
  { to: "/admin/classes", icon: CalendarDays, labelKey: "adminClasses" },
  { to: "/admin/disciplines", icon: BookOpen, labelKey: "adminDisciplines" },
  { to: "/admin/finance", icon: HandCoins, labelKey: "navFinance" },
  { to: "/admin/family-communication", icon: Mail, labelKey: "navFamilyCommunication" },
  { to: "/admin/academic", icon: SlidersHorizontal, labelKey: "navAcademicAdmin" },
  { to: "/admin/academic-requests", icon: ListChecks, labelKey: "navAcademicRequestsReview" },
  { to: "/admin/profile", icon: UserRound, labelKey: "navProfile" },
]

export const ownerNav = [
  { to: "/owner", icon: LayoutDashboard, labelKey: "controlPanel" },
  { to: "/owner/profile", icon: UserRound, labelKey: "navProfile" },
]

// Pages reachable from the user menu rather than the sidebar.
const extraTitles = [{ suffix: "/settings", labelKey: "settings", icon: Settings }]

const ROOTS = new Set(["/teacher", "/student", "/admin", "/owner"])

export function navForRole(role) {
  if (role === "owner") return ownerNav
  if (role === "admin") return adminNav
  if (role === "teacher" || role === "professor") return professorNav
  return studentNav
}

/** True when a menu entry must only match its exact path (role home pages). */
export function isExactNavItem(to) {
  return ROOTS.has(to)
}

/** The menu entry describing `pathname`, or null when the page is not in the menu. */
export function findNavItem(role, pathname = "") {
  const path = pathname.replace(/\/+$/, "") || "/"
  const items = navForRole(role)
  const exact = items.find((item) => item.to === path)
  if (exact) return exact
  const nested = items
    .filter((item) => !ROOTS.has(item.to) && path.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]
  if (nested) return nested
  return extraTitles.find((item) => path.endsWith(item.suffix)) ?? null
}

/** i18n key of the role label ("teacher" is shown as professor). */
export function roleLabelKey(role) {
  return role === "teacher" || role === "professor" ? "roleprofessor" : `role${role}`
}
