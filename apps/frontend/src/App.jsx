import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext.jsx"
import AppShell from "./components/AppShell.jsx"
import ProtectedRoute from "./components/ProtectedRoute.jsx"
import Landing from "./pages/Landing.jsx"
import Login from "./pages/auth/Login.jsx"
import ChangePassword from "./pages/auth/ChangePassword.jsx"
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
  ProfessorDashboard,
  ProfessorGrades,
  ProfessorAttendance,
  ProfessorResources,
  ProfessorAssignments,
  ProfessorMessages,
  ProfessorForum,
  ProfessorAcademicRequests,
  ProfessorLessonPlans,
} from "./modules/professor/index.js"
import {
  StudentDashboard,
  StudentResults,
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
              <Route path="/pagamento-escolaridade" element={<GuardianTuitionPayment />} />
              <Route path="/familia" element={<FamilyPortal />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/change-password" element={<ChangePassword />} />
              </Route>

              <Route element={<ProtectedRoute role="professor" />}>
                <Route path="/professor" element={<AppShell role="professor" />}>
                  <Route index element={<ProfessorDashboard />} />
                  <Route path="notes" element={<ProfessorGrades />} />
                  <Route path="presence" element={<ProfessorAttendance />} />
                  <Route path="ressources" element={<ProfessorResources />} />
                  <Route path="tarefas" element={<ProfessorAssignments />} />
                    <Route path="lesson-plans" element={<ProfessorLessonPlans />} />
                  <Route path="forum" element={<ProfessorForum />} />
                  <Route path="messages" element={<ProfessorMessages />} />
                  <Route path="profile" element={<UserProfile />} />
                  <Route path="academic-requests" element={<ProfessorAcademicRequests />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute role="student" />}>
                <Route path="/student" element={<AppShell role="student" />}>
                  <Route index element={<StudentDashboard />} />
                  <Route path="resultats" element={<StudentResults />} />
                  <Route path="horaire" element={<StudentSchedule />} />
                  <Route path="ressources" element={<StudentResources />} />
                  <Route path="tarefas" element={<StudentAssignments />} />
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
                  <Route path="academic-requests" element={<ProfessorAcademicRequests />} />
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
