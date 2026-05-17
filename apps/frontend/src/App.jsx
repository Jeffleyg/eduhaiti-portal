import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext.jsx"
import AppShell from "./components/AppShell.jsx"
import ProtectedRoute from "./components/ProtectedRoute.jsx"
import Landing from "./pages/Landing.jsx"
import Login from "./pages/auth/Login.jsx"
import ChangePassword from "./pages/auth/ChangePassword.jsx"
import RedeemAccess from "./pages/auth/RedeemAccess.jsx"
import OwnerDashboard from "./pages/owner/OwnerDashboard.jsx"
import {
  AdminUsers,
  AdminStudentManagement,
  AdminDisciplineManagement,
  AdminClassManagement,
  AdminFinanceControl,
  AdminAcademicConfig,
  AdminFamilyCommunication,
} from "./modules/admin/index.js"
import {
  TeacherDashboard,
  TeacherGrades,
  TeacherAttendance,
  TeacherResources,
  TeacherAssignments,
  TeacherMessages,
  TeacherForum,
  TeacherAcademicRequests,
  TeacherLessonPlans,
} from "./modules/teacher/index.js"
import {
  StudentDashboard,
  StudentGrades,
  StudentTranscript,
  StudentSchedule,
  StudentResources,
  StudentAssignments,
  StudentMessages,
  StudentForum,
  StudentAcademicRequests,
  StudentLessonPlans,
} from "./modules/student/index.js"
import { UserProfile, Settings } from "./modules/common/index.js"
import { GuardianTuitionPayment } from "./modules/payments/index.js"
import { FamilyPortal } from "./modules/family/index.js"
import { SurvivalModeProvider } from "./context/SurvivalModeContext.jsx"
import { SyncControlProvider } from "./context/SyncControlContext.jsx"

function App() {
  return (
    <AuthProvider>
      <SurvivalModeProvider>
        <SyncControlProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/redeem-access" element={<RedeemAccess />} />
              <Route path="/tuition-payment" element={<GuardianTuitionPayment />} />
              <Route path="/family" element={<FamilyPortal />} />
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
                  <Route path="resources" element={<TeacherResources />} />
                  <Route path="assignments" element={<TeacherAssignments />} />
                    <Route path="lesson-plans" element={<TeacherLessonPlans />} />
                  <Route path="forum" element={<TeacherForum />} />
                  <Route path="messages" element={<TeacherMessages />} />
                  <Route path="profile" element={<UserProfile />} />
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
                  <Route path="forum" element={<StudentForum />} />
                  <Route path="messages" element={<StudentMessages />} />
                  <Route path="profile" element={<UserProfile />} />
                    <Route path="settings" element={<Settings />} />
                  <Route path="academic-requests" element={<StudentAcademicRequests />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute role="admin" />}>
                <Route path="/admin" element={<AppShell role="admin" />}>
                  <Route index element={<AdminUsers />} />
                  <Route path="students" element={<AdminStudentManagement />} />
                  <Route path="classes" element={<AdminClassManagement />} />
                  <Route path="disciplines" element={<AdminDisciplineManagement />} />
                  <Route path="finance" element={<AdminFinanceControl />} />
                  <Route path="profile" element={<UserProfile />} />
                  <Route path="academic" element={<AdminAcademicConfig />} />
                  <Route path="academic-requests" element={<TeacherAcademicRequests />} />
                  <Route path="family-communication" element={<AdminFamilyCommunication />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute role="owner" />}>
                <Route path="/owner" element={<AppShell role="owner" />}>
                  <Route index element={<OwnerDashboard />} />
                  <Route path="profile" element={<UserProfile />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </SyncControlProvider>
      </SurvivalModeProvider>
    </AuthProvider>
  )
}

export default App
