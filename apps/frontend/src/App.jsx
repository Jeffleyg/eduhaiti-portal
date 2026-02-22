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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
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
            </Route>
          </Route>

          <Route element={<ProtectedRoute role="admin" />}>
            <Route path="/admin" element={<AppShell role="admin" />}>
              <Route index element={<AdminUsers />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
