import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { apiFetch } from "../utils/api"
import "../styles/TeacherAttendance.css"

export default function TeacherAttendance() {
  const { user } = useAuth()
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState({})
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  )


  useEffect(() => {
    if (user?.role === "TEACHER") {
      loadMyClasses()
    }
  }, [user])

  const loadMyClasses = async () => {
    try {
      const res = await apiFetch("/classes/my-classes")
      setClasses(res.data || [])
    } catch (error) {
      console.error("Failed to load classes:", error)
    }
  }

  const handleSelectClass = (classId) => {
    setSelectedClass(classId)
    const selected = classes.find((c) => c.id === classId)
    if (selected) {
      setStudents(selected.students || [])
      setAttendance({})
    }
  }

  const handleAttendanceChange = (studentId, status) => {
    setAttendance({
      ...attendance,
      [studentId]: status,
    })
  }

  const handleSaveAttendance = async () => {
    try {
      for (const [studentId, status] of Object.entries(attendance)) {
        if (status) {
          await apiFetch("/admin/attendance", {
            method: "POST",
            body: JSON.stringify({
              studentId,
              classId: selectedClass,
              date: new Date(selectedDate),
              status,
            }),
          })
        }
      }
      alert("Presença registrada com sucesso!")
      setAttendance({})
    } catch (error) {
      console.error("Failed to save attendance:", error)
      alert("Erro ao registrar presença")
    }
  }

  const StatusButton = ({ status, currentStatus, studentId }) => (
    <button
      className={`btn-status ${currentStatus === status ? "active" : ""}`}
      onClick={() => handleAttendanceChange(studentId, status)}
      title={status}
    >
      {status === "PRESENT" && "✓"}
      {status === "ABSENT" && "✕"}
      {status === "LATE" && "⏱"}
      {status === "EXCUSED" && "📋"}
    </button>
  )

  return (
    <div className="teacher-attendance">
      <h1>📋 Chamada Diária</h1>

      <div className="attendance-controls">
        <div>
          <label>Turma:</label>
          <select
            value={selectedClass || ""}
            onChange={(e) => handleSelectClass(e.target.value)}
          >
            <option value="">-- Escolha uma turma --</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Data:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {selectedClass && students.length > 0 && (
        <div className="attendance-list">
          <h2>Turma: {classes.find((c) => c.id === selectedClass)?.name}</h2>
          <h3>Data: {new Date(selectedDate).toLocaleDateString("pt-BR")}</h3>

          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Presença</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.name}</td>
                  <td className="attendance-buttons">
                    <StatusButton
                      status="PRESENT"
                      currentStatus={attendance[student.id]}
                      studentId={student.id}
                    />
                    <StatusButton
                      status="ABSENT"
                      currentStatus={attendance[student.id]}
                      studentId={student.id}
                    />
                    <StatusButton
                      status="LATE"
                      currentStatus={attendance[student.id]}
                      studentId={student.id}
                    />
                    <StatusButton
                      status="EXCUSED"
                      currentStatus={attendance[student.id]}
                      studentId={student.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            className="btn btn-success"
            onClick={handleSaveAttendance}
            disabled={Object.keys(attendance).length === 0}
          >
            ✓ Salvar Presença
          </button>
        </div>
      )}
    </div>
  )
}
