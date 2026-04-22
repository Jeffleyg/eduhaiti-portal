import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext.jsx"
import AppShell from "./components/AppShell.jsx"
import ProtectedRoute from "./components/ProtectedRoute.jsx"
import Landing from "./pages/Landing.jsx"
import Login from "./pages/auth/Login.jsx"
import ChangePassword from "./pages/auth/ChangePassword.jsx"
import AdminUsers from "./pages/admin/AdminUsers.jsx"
import ProfessorDashboard from "./pages/professor/ProfessorDashboard.jsx"
import ProfessorGrades from "./pages/professor/ProfessorGrades.jsx"
import ProfessorAttendance from "./pages/professor/ProfessorAttendance.jsx"
import ProfessorResources from "./pages/professor/ProfessorResources.jsx"
import ProfessorAssignments from "./pages/professor/ProfessorAssignments.jsx"
import ProfessorMessages from "./pages/professor/ProfessorMessages.jsx"
import StudentDashboard from "./pages/student/StudentDashboard.jsx"
import StudentResults from "./pages/student/StudentResults.jsx"
import StudentSchedule from "./pages/student/StudentSchedule.jsx"
import StudentResources from "./pages/student/StudentResources.jsx"
import StudentAssignments from "./pages/student/StudentAssignments.jsx"
import StudentMessages from "./pages/student/StudentMessages.jsx"
import AdminAcademicConfig from "./pages/admin/AdminAcademicConfig.jsx"
import AdminStudentManagement from "./pages/admin/AdminStudentManagement.jsx"
import AdminDisciplineManagement from "./pages/admin/AdminDisciplineManagement.jsx"
import AdminClassManagement from "./pages/admin/AdminClassManagement.jsx"
import AdminFinanceControl from "./pages/admin/AdminFinanceControl.jsx"
import UserProfile from "./pages/common/UserProfile.jsx"
import ProfessorAcademicRequests from "./pages/professor/ProfessorAcademicRequests.jsx"
import StudentAcademicRequests from "./pages/student/StudentAcademicRequests.jsx"
import GuardianTuitionPayment from "./pages/GuardianTuitionPayment.jsx"
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
                  <Route path="messages" element={<StudentMessages />} />
                  <Route path="profile" element={<UserProfile />} />
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
