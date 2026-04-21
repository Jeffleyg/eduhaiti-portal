import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { apiFetch } from "../utils/api"
import "../styles/TeacherGrades.css"

export default function TeacherGrades() {
  const { user } = useAuth()
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents] = useState([])
  const [grades, setGrades] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.role === "TEACHER") {
      loadMyClasses()
    }
  }, [user])

  const loadMyClasses = async () => {
    setLoading(true)
    try {
      const res = await apiFetch("/classes/my-classes")
      setClasses(res.data || [])
    } catch (error) {
      console.error("Failed to load classes:", error)
    }
    setLoading(false)
  }

  const handleSelectClass = (classId) => {
    setSelectedClass(classId)
    const selected = classes.find((c) => c.id === classId)
    if (selected) {
      setStudents(selected.students || [])
      setGrades({})
    }
  }

  const handleGradeChange = (studentId, score) => {
    setGrades({
      ...grades,
      [studentId]: parseFloat(score),
    })
  }

  const handleSaveGrades = async () => {
    try {
      // Save all grades for this class
      for (const [studentId, score] of Object.entries(grades)) {
        if (score !== "" && score !== null) {
          await apiFetch("/admin/grades", {
            method: "POST",
            body: JSON.stringify({
              studentId,
              classId: selectedClass,
              disciplineId: "", // TODO: select discipline
              academicYearId: "", // TODO: get current academic year
              score,
              maxScore: 20,
            }),
          })
        }
      }
      alert("Notas salvas com sucesso!")
      setGrades({})
    } catch (error) {
      console.error("Failed to save grades:", error)
      alert("Erro ao salvar notas")
    }
  }

  return (
    <div className="teacher-grades">
      <h1>📊 Lançamento de Notas</h1>

      <div className="class-selector">
        <label>Selecione una Turma:</label>
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

      {selectedClass && students.length > 0 && (
        <div className="grades-table">
          <h2>Turma: {classes.find((c) => c.id === selectedClass)?.name}</h2>

          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Matricula</th>
                <th>Nota (0-20)</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.name}</td>
                  <td>{student.enrollmentNumber || "-"}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.5"
                      value={grades[student.id] || ""}
                      onChange={(e) =>
                        handleGradeChange(student.id, e.target.value)
                      }
                      placeholder="Digite a nota"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            className="btn btn-success"
            onClick={handleSaveGrades}
            disabled={Object.keys(grades).length === 0}
          >
            ✓ Salvar Notas
          </button>
        </div>
      )}

      {loading && <p>Carregando...</p>}
      {!loading && classes.length === 0 && (
        <p className="no-data">Você não tem turmas atribuídas ainda.</p>
      )}
    </div>
  )
}
