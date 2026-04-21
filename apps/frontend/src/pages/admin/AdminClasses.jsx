import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { apiFetch } from "../utils/api"
import "../styles/AdminClasses.css"

export default function AdminClasses() {
  const { user } = useAuth()
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [academicYears, setAcademicYears] = useState([])
  const [series, setSeries] = useState([])
  const [teachers, setTeachers] = useState([])

  const [formData, setFormData] = useState({
    name: "",
    academicYearId: "",
    seriesId: "",
    teacherId: "",
    maxStudents: 30,
  })

  useEffect(() => {
    if (user?.role === "ADMIN") {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load classes
      const classesRes = await apiFetch("/admin/classes")
      setClasses(classesRes.data || [])
    } catch (error) {
      console.error("Failed to load classes:", error)
    }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const response = await apiFetch("/admin/classes", {
        method: "POST",
        body: JSON.stringify(formData),
      })

      setClasses([...classes, response.data])
      setShowForm(false)
      setFormData({
        name: "",
        academicYearId: "",
        seriesId: "",
        teacherId: "",
        maxStudents: 30,
      })
    } catch (error) {
      console.error("Failed to create class:", error)
      alert("Erro ao criar turma")
    }
  }

  const handleDelete = async (classId) => {
    if (confirm("Tem certeza que deseja deletar esta turma?")) {
      try {
        await apiFetch(`/admin/classes/${classId}`, { method: "DELETE" })
        setClasses(classes.filter((c) => c.id !== classId))
      } catch (error) {
        console.error("Failed to delete class:", error)
        alert("Erro ao deletar turma")
      }
    }
  }

  return (
    <div className="admin-classes">
      <h1>📚 Gestão de Turmas</h1>

      <button
        className="btn btn-primary"
        onClick={() => setShowForm(!showForm)}
      >
        {showForm ? "✕ Cancelar" : "+ Nova Turma"}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-container">
          <input
            type="text"
            placeholder="Nome da turma (ex: 3eme-A)"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            required
          />

          <select
            value={formData.academicYearId}
            onChange={(e) =>
              setFormData({ ...formData, academicYearId: e.target.value })
            }
            required
          >
            <option value="">Selecione o ano letivo</option>
          </select>

          <select
            value={formData.seriesId}
            onChange={(e) =>
              setFormData({ ...formData, seriesId: e.target.value })
            }
            required
          >
            <option value="">Selecione a série</option>
          </select>

          <select
            value={formData.teacherId}
            onChange={(e) =>
              setFormData({ ...formData, teacherId: e.target.value })
            }
          >
            <option value="">Selecione o professor (opcional)</option>
          </select>

          <input
            type="number"
            placeholder="Máximo de alunos"
            value={formData.maxStudents}
            onChange={(e) =>
              setFormData({ ...formData, maxStudents: parseInt(e.target.value) })
            }
            min="1"
            max="50"
          />

          <button type="submit" className="btn btn-success">
            ✓ Criar Turma
          </button>
        </form>
      )}

      {loading ? (
        <p>Carregando...</p>
      ) : classes.length === 0 ? (
        <p className="no-data">Nenhuma turma cadastrada</p>
      ) : (
        <div className="classes-grid">
          {classes.map((cls) => (
            <div key={cls.id} className="class-card">
              <h3>{cls.name}</h3>
              <p>
                <strong>Professor:</strong> {cls.teacher?.name || "Sem professor"}
              </p>
              <p>
                <strong>Alunos:</strong> {cls.students?.length || 0} /{" "}
                {cls.maxStudents}
              </p>
              <p>
                <strong>Série:</strong> {cls.series?.name}
              </p>
              <div className="actions">
                <button className="btn btn-sm btn-info">✏️ Editar</button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(cls.id)}
                >
                  🗑️ Deletar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
