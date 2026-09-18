import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiAssetUrl, apiFetch, apiUpload } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"
import { sanitizeText, maskName } from "../../lib/string.js"
import LoadingState from "../../components/LoadingState.jsx"
import SkeletonLoader from "../../components/SkeletonLoader.jsx"
import ListItemCard from "../../components/ListItemCard.jsx"
import { Download, FileText, UploadCloud, Users } from "lucide-react"

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
  const [message, setMessage] = useState("")
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("")
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [loadingFileId, setLoadingFileId] = useState("")

  const selectedAssignment = useMemo(
    () => assignments.find((item) => item.id === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId],
  )

  const setFeedback = (nextMessage = "") => {
    setError("")
    setMessage(nextMessage)
  }

  const fetchAssignments = async (classId) => {
    if (!classId) return

    setLoadingAssignments(true)
    setError("")
    try {
      const assignmentsRes = await apiFetch(`/assignments/class/${classId}`, { token })
      setAssignments(assignmentsRes ?? [])
      setSelectedAssignmentId((current) => {
        if (assignmentsRes?.some((item) => item.id === current)) {
          return current
        }
        return assignmentsRes?.[0]?.id ?? ""
      })
    } catch (fetchError) {
      setError(fetchError.message)
    } finally {
      setLoadingAssignments(false)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const classesRes = await apiFetch("/classes/my-classes", { token })
        setClasses(classesRes ?? [])
        if (classesRes && classesRes[0]) {
          setSelectedClass(classesRes[0].id)
          await fetchAssignments(classesRes[0].id)
        }
      } catch (error) {
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [token])

  const handleClassChange = (e) => {
    const classId = e.target.value
    setSelectedClass(classId)
    fetchAssignments(classId)
    setFeedback("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedClass || !formData.title || !formData.dueDate) return

    setCreating(true)
    setError("")
    setMessage("")
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
      await fetchAssignments(selectedClass)
      setFeedback("Tarefa criada com sucesso.")
    } catch (error) {
      setError(error.message)
    } finally {
      setCreating(false)
    }
  }

  const handleSubmissionFile = async (submission, action = "download") => {
    if (!submission?.filePath) return

    const url = apiAssetUrl(submission.filePath)
    if (!url) return

    setLoadingFileId(submission.id)
    setError("")
    setMessage("")
    try {
      if (action === "open") {
        window.open(url, "_blank", "noopener,noreferrer")
      } else {
        const link = document.createElement("a")
        link.href = url
        link.download = ""
        document.body.appendChild(link)
        link.click()
        link.remove()
      }
      setMessage(action === "open" ? "Entrega aberta para leitura." : "Download da entrega iniciado.")
    } catch (submissionError) {
      setError(submissionError.message)
    } finally {
      setLoadingFileId("")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Gerenciar Tarefas" subtitle="Crie e acompanhe tarefas da turma" />
        <SkeletonLoader type="card" count={3} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Gerenciar Tarefas" subtitle="Crie e acompanhe tarefas da turma" />

      <LoadingState type="banner" error={error} success={Boolean(message)} message={message} />

      <div className="module-card compact card-compact rounded-2xl border border-brand-navy/10 bg-white p-6">
        <h3 className="font-semibold text-brand-navy mb-4">Selecione a Turma</h3>
        <select
          value={selectedClass}
          onChange={handleClassChange}
          className="w-full px-4 py-2 border border-brand-navy/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red"
        >
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {sanitizeText(cls.name)}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleSubmit} className="module-card compact card-compact rounded-2xl border border-brand-navy/10 bg-white p-6 space-y-4">
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
          {file && <p className="text-xs text-brand-navy/60 mt-1">{sanitizeText(file.name)}</p>}
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
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-brand-navy">Tarefas da Turma</h3>
          <span className="badge bg-brand-navy/10 text-brand-navy">{assignments.length}</span>
        </div>

        {loadingAssignments ? (
          <SkeletonLoader type="list" count={3} />
        ) : assignments.length > 0 ? (
          <div className="space-y-3">
            {assignments.map((assignment) => {
              const submissions = assignment.submissions ?? []
              const submittedCount = submissions.length

              return (
                <ListItemCard
                  key={assignment.id}
                  id={assignment.id}
                  icon={<FileText className="h-5 w-5 text-brand-red" />}
                  title={assignment.title}
                  subtitle={assignment.description || "Sem descrição"}
                  status={`${submittedCount} entrega(s)`}
                  statusColor={submittedCount > 0 ? "green" : "yellow"}
                  preview={
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-brand-navy/60">Prazo</p>
                        <p className="font-semibold text-brand-navy">
                          {new Date(assignment.dueDate).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-brand-navy/60">Entregas</p>
                        <p className="font-semibold text-brand-navy">{submittedCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-brand-navy/60">Turma</p>
                        <p className="font-semibold text-brand-navy">{sanitizeText(classes.find((item) => item.id === selectedClass)?.name ?? "-")}</p>
                      </div>
                    </div>
                  }
                  onClick={() => setSelectedAssignmentId(assignment.id)}
                  isSelected={selectedAssignmentId === assignment.id}
                />
              )
            })}
          </div>
        ) : (
          <p className="text-center text-brand-navy/60">Nenhuma tarefa criada ainda</p>
        )}
      </div>

      <div className="module-card compact card-compact rounded-2xl border border-brand-navy/10 bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-brand-navy">Entregas da tarefa selecionada</h3>
            {selectedAssignment ? (
            <span className="badge bg-brand-sky/20 text-brand-navy">{selectedAssignment.submissions?.length ?? 0} entrega(s)</span>
          ) : null}
        </div>

        {!selectedAssignment ? (
          <p className="mt-4 text-sm text-brand-navy/60">Selecione uma tarefa para ver e baixar as entregas.</p>
        ) : selectedAssignment.submissions?.length > 0 ? (
          <div className="mt-4 space-y-3">
            {selectedAssignment.submissions.map((submission) => (
              <div key={submission.id} className="rounded-2xl border border-brand-navy/10 bg-sand/60 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-white p-2 text-brand-navy shadow-sm">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-brand-navy">{maskName(submission.student?.name ?? submission.student?.email, "student")}</p>
                      <p className="text-xs text-brand-navy/60">
                        Entregue em {new Date(submission.submittedAt).toLocaleString("pt-BR")}
                      </p>
                      {submission.grade !== null && submission.grade !== undefined ? (
                        <p className="text-xs font-semibold text-brand-navy">Nota: {submission.grade}</p>
                      ) : null}
                      {submission.feedback ? (
                        <p className="mt-1 text-xs text-brand-navy/70">Feedback: {sanitizeText(submission.feedback)}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="outline-button inline-flex items-center gap-2"
                      onClick={() => handleSubmissionFile(submission, "open")}
                      disabled={loadingFileId === submission.id || !submission.filePath}
                    >
                      <FileText className="h-4 w-4" />
                      Ler
                    </button>
                    <button
                      type="button"
                      className="primary-button inline-flex items-center gap-2"
                      onClick={() => handleSubmissionFile(submission, "download")}
                      disabled={loadingFileId === submission.id || !submission.filePath}
                    >
                      <Download className="h-4 w-4" />
                      {loadingFileId === submission.id ? "Baixando..." : "Baixar"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-brand-navy/60">Ainda não há entregas para esta tarefa.</p>
        )}
      </div>
    </div>
  )
}

export default ProfessorAssignments
