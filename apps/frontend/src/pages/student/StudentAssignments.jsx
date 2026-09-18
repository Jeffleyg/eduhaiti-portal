import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch, apiUpload } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"
import { sanitizeText } from "../../lib/string.js"
import { Upload } from "lucide-react"
import { useSurvivalMode } from "../../context/useSurvivalMode.js"
import LoadMoreList from "../../components/LoadMoreList.jsx"
import LoadingState from "../../components/LoadingState.jsx"
import SkeletonLoader from "../../components/SkeletonLoader.jsx"

function StudentAssignments() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const { disableImages } = useSurvivalMode()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState({})
  const [selectedFile, setSelectedFile] = useState({})
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const assignmentsRes = await apiFetch("/assignments/my-assignments", { token })
        setAssignments(assignmentsRes ?? [])
      } catch (fetchError) {
        setError(fetchError.message)
      } finally {
        setLoading(false)
      }
    }

    fetchAssignments()
  }, [token])

  const handleSubmit = async (assignmentId) => {
    const file = selectedFile[assignmentId]
    if (!file) return

    setSubmitting({ ...submitting, [assignmentId]: true })
    setError("")
    setMessage("")
    try {
      const formDataToSend = new FormData()
      formDataToSend.append("file", file)

      await apiUpload(`/assignments/${assignmentId}/submit`, {
        method: "POST",
        token,
        formData: formDataToSend,
      })

      setSelectedFile({ ...selectedFile, [assignmentId]: null })
      const assignmentsRes = await apiFetch("/assignments/my-assignments", { token })
      setAssignments(assignmentsRes ?? [])
      setMessage("Tarefa entregue com sucesso.")
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting({ ...submitting, [assignmentId]: false })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader title={t("assignmentsTitle") || 'Assignments'} subtitle={t("assignmentsSubtitle") || 'View and submit your assigned tasks'} />
        <SkeletonLoader type="list" count={3} />
      </div>
    )
  }

  const isOverdue = (dueDate) => new Date(dueDate) < new Date()

  return (
    <div className="space-y-6">
      <SectionHeader title={t("assignmentsTitle") || 'Assignments'} subtitle={t("assignmentsSubtitle") || 'View and submit your assigned tasks'} />

      <LoadingState type="banner" error={error} success={Boolean(message)} message={message} />

      <div className="space-y-4">
        {assignments.length > 0 ? (
          <LoadMoreList
            items={assignments}
            initialLimit={5}
            step={5}
            renderItem={(assignment) => {
              const submitted = assignment.submissions && assignment.submissions.length > 0
              const overdue = isOverdue(assignment.dueDate)

              return (
                <div
                  key={assignment.id}
                  className={`rounded-2xl border ${
                    submitted ? "border-green-400/50" : overdue ? "border-brand-red/50" : "border-brand-navy/10"
                  } bg-white p-6`}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-semibold text-brand-navy text-lg">{sanitizeText(assignment.title)}</h3>
                      <p className="text-sm text-brand-navy/60 mt-1">{sanitizeText(assignment.description)}</p>
                      <p className={`text-xs mt-2 font-semibold ${overdue ? "text-brand-red" : "text-brand-navy/60"}`}>
                        {t("dueDate")} : {new Date(assignment.dueDate).toLocaleDateString()} {" "}
                        {new Date(assignment.dueDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        submitted ? "bg-green-100 text-green-700" : overdue ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {submitted ? `✓ ${t("delivered") || 'Delivered'}` : overdue ? t("overdue") || 'Overdue' : t("pending") || 'Pending'}
                    </span>
                  </div>

                  {!submitted && !overdue && (
                    <div className="mt-4 border-t border-brand-navy/10 pt-4">
                      <label className="block text-sm font-semibold text-brand-navy mb-3">{t("submitAssignment") || 'Submit assignment'}</label>
                      <div className="flex gap-3">
                        <input
                          type="file"
                          onChange={(e) => setSelectedFile({ ...selectedFile, [assignment.id]: e.target.files?.[0] })}
                          className="flex-1 px-4 py-2 border border-brand-navy/20 rounded-xl text-sm"
                          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
                        />
                        <button
                          onClick={() => handleSubmit(assignment.id)}
                          disabled={submitting[assignment.id] || !selectedFile[assignment.id]}
                          className="px-6 py-2 bg-gradient-to-r from-brand-red to-brand-red hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl transition-all whitespace-nowrap"
                        >
                          {submitting[assignment.id] ? t("sending") : t("deliver") || 'Deliver'}
                        </button>
                      </div>
                      {selectedFile[assignment.id] && (
                        <p className="text-xs text-brand-navy/60 mt-2">📎 {sanitizeText(selectedFile[assignment.id].name)}</p>
                      )}
                    </div>
                  )}

                  {submitted && (
                    <div className="mt-4 border-t border-green-200 pt-4">
                      <p className="text-sm text-green-700">
                        ✓ Tarefa entregue em {new Date(assignment.submissions[0].submittedAt).toLocaleDateString("pt-BR")}
                      </p>
                      {assignment.submissions[0].grade !== null && (
                        <p className="text-sm font-semibold text-brand-navy mt-1">Nota: {assignment.submissions[0].grade}</p>
                      )}
                      {assignment.submissions[0].feedback && (
                        <p className="text-sm text-brand-navy/70 mt-2">Feedback: {sanitizeText(assignment.submissions[0].feedback)}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            }}
          />
        ) : (
          <p className="text-center text-brand-navy/60 py-8">{t("noAssignments")}</p>
        )}
      </div>
    </div>
  )
}

export default StudentAssignments
