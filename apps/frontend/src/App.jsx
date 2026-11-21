import { Suspense, lazy } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext.jsx"
import AppShell from "./components/AppShell.jsx"
import ProtectedRoute from "./components/ProtectedRoute.jsx"
import ErrorBoundary from "./components/ErrorBoundary.jsx"
import Landing from "./pages/Landing.jsx"
import Login from "./pages/auth/Login.jsx"
import { SurvivalModeProvider } from "./context/SurvivalModeContext.jsx"
import { SyncControlProvider } from "./context/SyncControlContext.jsx"

// Route-level code splitting: each role's pages (and heavy libraries such as
// jsPDF) are downloaded only when that area is opened - important on 2G.
const fromModule = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })))
const adminPages = () => import("./modules/admin/index.js")
const teacherPages = () => import("./modules/teacher/index.js")
const studentPages = () => import("./modules/student/index.js")
const commonPages = () => import("./modules/common/index.js")

const ChangePassword = lazy(() => import("./pages/auth/ChangePassword.jsx"))
const RedeemAccess = lazy(() => import("./pages/auth/RedeemAccess.jsx"))
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword.jsx"))
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword.jsx"))
const VerifyTranscript = lazy(() => import("./pages/VerifyTranscript.jsx"))
const OwnerDashboard = lazy(() => import("./pages/owner/OwnerDashboard.jsx"))
const GuardianTuitionPayment = fromModule(() => import("./modules/payments/index.js"), "GuardianTuitionPayment")
const FamilyPortal = fromModule(() => import("./modules/family/index.js"), "FamilyPortal")
const UserProfile = fromModule(commonPages, "UserProfile")
const Settings = fromModule(commonPages, "Settings")
const Announcements = fromModule(commonPages, "Announcements")
const AttendanceReport = fromModule(commonPages, "AttendanceReport")

const AdminDashboard = fromModule(adminPages, "AdminDashboard")
const AdminUsers = fromModule(adminPages, "AdminUsers")
const AdminAnnouncements = fromModule(adminPages, "AdminAnnouncements")
const AdminEarlyWarning = fromModule(adminPages, "AdminEarlyWarning")
const AdminStudentManagement = fromModule(adminPages, "AdminStudentManagement")
const AdminDisciplineManagement = fromModule(adminPages, "AdminDisciplineManagement")
const AdminClassManagement = fromModule(adminPages, "AdminClassManagement")
const AdminFinanceControl = fromModule(adminPages, "AdminFinanceControl")
const AdminAcademicConfig = fromModule(adminPages, "AdminAcademicConfig")
const AdminFamilyCommunication = fromModule(adminPages, "AdminFamilyCommunication")

const TeacherDashboard = fromModule(teacherPages, "TeacherDashboard")
const TeacherGrades = fromModule(teacherPages, "TeacherGrades")
const TeacherAttendance = fromModule(teacherPages, "TeacherAttendance")
const TeacherResources = fromModule(teacherPages, "TeacherResources")
const TeacherAssignments = fromModule(teacherPages, "TeacherAssignments")
const TeacherMessages = fromModule(teacherPages, "TeacherMessages")
const TeacherForum = fromModule(teacherPages, "TeacherForum")
const TeacherAcademicRequests = fromModule(teacherPages, "TeacherAcademicRequests")
const TeacherLessonPlans = fromModule(teacherPages, "TeacherLessonPlans")

const StudentDashboard = fromModule(studentPages, "StudentDashboard")
const StudentGrades = fromModule(studentPages, "StudentGrades")
const StudentTranscript = fromModule(studentPages, "StudentTranscript")
const StudentSchedule = fromModule(studentPages, "StudentSchedule")
const StudentResources = fromModule(studentPages, "StudentResources")
const StudentAssignments = fromModule(studentPages, "StudentAssignments")
const StudentMessages = fromModule(studentPages, "StudentMessages")
const StudentForum = fromModule(studentPages, "StudentForum")
const StudentAcademicRequests = fromModule(studentPages, "StudentAcademicRequests")
const StudentLessonPlans = fromModule(studentPages, "StudentLessonPlans")

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-navy/20 border-t-brand-navy" />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <SurvivalModeProvider>
        <SyncControlProvider>
          <BrowserRouter>
            <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/redeem-access" element={<RedeemAccess />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/tuition-payment" element={<GuardianTuitionPayment />} />
              <Route path="/family" element={<FamilyPortal />} />
              <Route path="/verify-transcript/:id" element={<VerifyTranscript />} />
              <Route path="/pagamento-escolaridade" element={<Navigate to="/tuition-payment" replace />} />
              <Route path="/familia" element={<Navigate to="/family" replace />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/change-password" element={<ChangePassword />} />
              </Route>

              <Route path="/professor" element={<Navigate to="/teacher" replace />} />
              <Route path="/professor/profile" element={<Navigate to="/teacher/profile" replace />} />
              <Route path="/professor/notes" element={<Navigate to="/teacher/grades" replace />} />
              <Route path="/professor/presence" element={<Navigate to="/teacher/attendance" replace />} />
              <Route path="/professor/ressources" element={<Navigate to="/teacher/resources" replace />} />
              <Route path="/professor/tarefas" element={<Navigate to="/teacher/assignments" replace />} />
              <Route path="/professor/forum" element={<Navigate to="/teacher/forum" replace />} />
              <Route path="/professor/messages" element={<Navigate to="/teacher/messages" replace />} />
              <Route path="/professor/academic-requests" element={<Navigate to="/teacher/academic-requests" replace />} />

              <Route path="/student/resultats" element={<Navigate to="/student/grades" replace />} />
              <Route path="/student/horaire" element={<Navigate to="/student/schedule" replace />} />
              <Route path="/student/ressources" element={<Navigate to="/student/resources" replace />} />
              <Route path="/student/tarefas" element={<Navigate to="/student/assignments" replace />} />

              <Route element={<ProtectedRoute role="teacher" />}>
                <Route path="/teacher" element={<AppShell role="teacher" />}>
                  <Route index element={<TeacherDashboard />} />
                  <Route path="grades" element={<TeacherGrades />} />
                  <Route path="attendance" element={<TeacherAttendance />} />
                  <Route path="attendance-report" element={<AttendanceReport />} />
                  <Route path="resources" element={<TeacherResources />} />
                  <Route path="assignments" element={<TeacherAssignments />} />
                  <Route path="lesson-plans" element={<TeacherLessonPlans />} />
                  <Route path="announcements" element={<Announcements />} />
                  <Route path="forum" element={<TeacherForum />} />
                  <Route path="messages" element={<TeacherMessages />} />
                  <Route path="profile" element={<UserProfile />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="academic-requests" element={<TeacherAcademicRequests />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute role="student" />}>
                <Route path="/student" element={<AppShell role="student" />}>
                  <Route index element={<StudentDashboard />} />
                  <Route path="grades" element={<StudentGrades />} />
                  <Route path="transcript" element={<StudentTranscript />} />
                  <Route path="schedule" element={<StudentSchedule />} />
                  <Route path="resources" element={<StudentResources />} />
                  <Route path="assignments" element={<StudentAssignments />} />
                  <Route path="lesson-plans" element={<StudentLessonPlans />} />
                  <Route path="announcements" element={<Announcements />} />
                  <Route path="forum" element={<StudentForum />} />
                  <Route path="messages" element={<StudentMessages />} />
                  <Route path="profile" element={<UserProfile />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="academic-requests" element={<StudentAcademicRequests />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute role="admin" />}>
                <Route path="/admin" element={<AppShell role="admin" />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="announcements" element={<AdminAnnouncements />} />
                  <Route path="attendance" element={<AttendanceReport />} />
                  <Route path="early-warning" element={<AdminEarlyWarning />} />
                  <Route path="students" element={<AdminStudentManagement />} />
                  <Route path="classes" element={<AdminClassManagement />} />
                  <Route path="disciplines" element={<AdminDisciplineManagement />} />
                  <Route path="finance" element={<AdminFinanceControl />} />
                  <Route path="profile" element={<UserProfile />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="academic" element={<AdminAcademicConfig />} />
                  <Route path="academic-requests" element={<TeacherAcademicRequests />} />
                  <Route path="family-communication" element={<AdminFamilyCommunication />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute role="owner" />}>
                <Route path="/owner" element={<AppShell role="owner" />}>
                  <Route index element={<OwnerDashboard />} />
                  <Route path="profile" element={<UserProfile />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </SyncControlProvider>
      </SurvivalModeProvider>
    </AuthProvider>
  )
}

export default App
