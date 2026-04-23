import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch, apiUpload } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"

function ProfessorAssignments() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedClass, setSelectedClass] = useState("")
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
  })
  const [file, setFile] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const classesRes = await apiFetch("/classes/my-classes", { token })
        setClasses(classesRes ?? [])
        if (classesRes && classesRes[0]) {
          setSelectedClass(classesRes[0].id)
          const assignmentsRes = await apiFetch(`/assignments/class/${classesRes[0].id}`, { token })
          setAssignments(assignmentsRes ?? [])
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [token])

  const loadAssignmentsForClass = async (classId) => {
    try {
      const assignmentsRes = await apiFetch(`/assignments/class/${classId}`, { token })
      setAssignments(assignmentsRes ?? [])
    } catch (error) {
      setError(error.message)
    }
  }

  const handleClassChange = (e) => {
    const classId = e.target.value
    setSelectedClass(classId)
    loadAssignmentsForClass(classId)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedClass || !formData.title || !formData.dueDate) return

    setCreating(true)
    setError("")
    try {
      const formDataToSend = new FormData()
      if (file) formDataToSend.append("file", file)
      formDataToSend.append("title", formData.title)
      formDataToSend.append("description", formData.description)
      formDataToSend.append("dueDate", formData.dueDate)

      await apiUpload(`/assignments/create/${selectedClass}`, {
        method: "POST",
        token,
        formData: formDataToSend,
      })

      setFormData({ title: "", description: "", dueDate: "" })
      setFile(null)
      await loadAssignmentsForClass(selectedClass)
    } catch (error) {
      setError(error.message)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <div className="text-center text-brand-navy">{t("loading")}</div>
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Gerenciar Tarefas" subtitle="Crie e acompanhe tarefas da turma" />

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}

      <div className="rounded-2xl border border-brand-navy/10 bg-white p-6">
        <h3 className="font-semibold text-brand-navy mb-4">Selecione a Turma</h3>
        <select
          value={selectedClass}
          onChange={handleClassChange}
          className="w-full px-4 py-2 border border-brand-navy/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red"
        >
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-brand-navy/10 bg-white p-6 space-y-4">
        <h3 className="font-semibold text-brand-navy">Criar Nova Tarefa</h3>

        <div>
          <label className="block text-sm font-semibold text-brand-navy mb-2">Título</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            className="w-full px-4 py-2 border border-brand-navy/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red"
            placeholder="Ex: Exercício de Matemática"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-brand-navy mb-2">Descrição</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border border-brand-navy/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red"
            placeholder="Instruções e detalhes da tarefa"
            rows={4}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-brand-navy mb-2">Data de Expiração</label>
          <input
            type="datetime-local"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            required
            className="w-full px-4 py-2 border border-brand-navy/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-brand-navy mb-2">Arquivo (opcional)</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0])}
            className="w-full px-4 py-2 border border-brand-navy/20 rounded-xl"
            accept=".pdf,.ppt,.pptx,.doc,.docx"
          />
          {file && <p className="text-xs text-brand-navy/60 mt-1">{file.name}</p>}
        </div>

        <button
          type="submit"
          disabled={creating || !formData.title || !formData.dueDate}
          className="w-full py-3 bg-gradient-to-r from-brand-red to-brand-red hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
        >
          {creating ? "Criando..." : "Criar Tarefa"}
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="font-semibold text-brand-navy">Tarefas da Turma</h3>
        {assignments.length > 0 ? (
          assignments.map((assignment) => (
            <div key={assignment.id} className="rounded-2xl border border-brand-navy/10 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-brand-navy">{assignment.title}</p>
                  <p className="text-sm text-brand-navy/60 mt-1">{assignment.description}</p>
                  <p className="text-xs text-brand-navy/50 mt-2">
                    Prazo: {new Date(assignment.dueDate).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-brand-sky/20 text-brand-navy px-3 py-1 rounded-full text-xs font-semibold">
                    {assignment.submissions?.length ?? 0} entrega(s)
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-brand-navy/60">Nenhuma tarefa criada ainda</p>
        )}
      </div>
    </div>
  )
}

export default ProfessorAssignments
