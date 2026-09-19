import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import DataTablePaginated from "../../components/DataTablePaginated.jsx"
import SectionHeader from "../../components/SectionHeader.jsx"
import LoadingState from "../../components/LoadingState.jsx"
import SkeletonLoader from "../../components/SkeletonLoader.jsx"
import Button from "../../components/Button.jsx"
import Select from "../../components/Select.jsx"
import Feedback from "../../components/Feedback.jsx"
import { useTranslation } from "react-i18next"
import { sanitizeText, maskName } from "../../lib/string.js"

const OFFLINE_ATTENDANCE_QUEUE_KEY = "eduhaiti_offline_attendance_queue"

function ProfessorAttendance() {
  const { t } = useTranslation()
  const { token } = useAuth()

  const statusOptions = [
    { value: "PRESENT", label: t("attendancePresent") || "Prezan" },
    { value: "ABSENT", label: t("attendanceAbsent") || "Absan" },
    { value: "LATE", label: t("attendanceLate") || "An reta" },
    { value: "EXCUSED", label: t("attendanceExcused") || "Eskize" },
  ]

  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)

  // Atualiza contador de chamadas pendentes salvas localmente
  const updateOfflineCount = () => {
    try {
      const queue = JSON.parse(localStorage.getItem(OFFLINE_ATTENDANCE_QUEUE_KEY) || "[]")
      setPendingSyncCount(queue.length)
    } catch {
      setPendingSyncCount(0)
    }
  }

  useEffect(() => {
    updateOfflineCount()
  }, [])

  // Carregar turmas do professor
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setLoading(true)
        const response = await apiFetch("/classes/my-classes", { token }).catch(async () => {
          return await apiFetch("/classes", { token })
        })
        const data = Array.isArray(response) ? response : response?.data || []
        setClasses(data)
        if (data.length > 0) {
          setSelectedClassId(data[0].id)
        }
      } catch (err) {
        console.error("Erro ao carregar turmas:", err)
        setFeedback({
          type: "error",
          message: t("common.errorLoading", "Erè pandan chajman done yo."),
        })
      } finally {
        setLoading(false)
      }
    }

    fetchClasses()
  }, [token, t])

  // Carregar lista de alunos e presença da turma selecionada
  useEffect(() => {
    if (!selectedClassId) return

    const fetchAttendance = async () => {
      try {
        setLoading(true)
        setFeedback(null)
        const res = await apiFetch(`/attendance/class/${selectedClassId}?date=${selectedDate}`, { token })
        const records = Array.isArray(res) ? res : res?.data || []
        setAttendanceRecords(records)
      } catch (err) {
        console.error("Erro ao carregar presença:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()
  }, [selectedClassId, selectedDate, token])

  const handleStatusChange = (studentId, status) => {
    setAttendanceRecords((prev) =>
      prev.map((rec) => (rec.studentId === studentId || rec.id === studentId ? { ...rec, status } : rec))
    )
  }

  // Submeter chamada (com suporte nativo a contingência offline)
  const submitAttendance = async () => {
    if (!selectedClassId) return

    const payload = {
      classId: selectedClassId,
      date: selectedDate,
      records: attendanceRecords.map((r) => ({
        studentId: r.studentId || r.id,
        status: r.status || "PRESENT",
      })),
      timestamp: new Date().toISOString(),
    }

    try {
      setSubmitting(true)
      setFeedback(null)

      // Chamada real ao endpoint oficial de presença
      await apiFetch("/attendance", {
        method: "POST",
        token,
        body: payload,
      })

      setFeedback({
        type: "success",
        message: t("attendanceSaved", "Prezans anrejistre avèk siksè!"),
      })
    } catch (err) {
      console.warn("Falha de rede ao submeter presença. A guardar na fila local:", err.message)

      // Contingência Offline (Survival Mode)
      try {
        const queue = JSON.parse(localStorage.getItem(OFFLINE_ATTENDANCE_QUEUE_KEY) || "[]")
        queue.push({ ...payload, offlineId: `att_${Date.now()}` })
        localStorage.setItem(OFFLINE_ATTENDANCE_QUEUE_KEY, JSON.stringify(queue))
        updateOfflineCount()

        setFeedback({
          type: "info",
          message: t(
            "attendanceOfflineSaved",
            "Ou pa gen rezo. Prezans lan sove lokalman epi l ap senkronize le w konekte."
          ),
        })
      } catch (storageErr) {
        setFeedback({
          type: "error",
          message: t("offlineError", "Erè pandan anrejistreman dekonekte a."),
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Sincronizar dados pendentes quando houver rede
  const syncOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_ATTENDANCE_QUEUE_KEY) || "[]")
    if (queue.length === 0) return

    try {
      setSubmitting(true)
      const remaining = []

      for (const item of queue) {
        try {
          await apiFetch("/attendance", {
            method: "POST",
            token,
            body: item,
          })
        } catch {
          remaining.push(item)
        }
      }

      localStorage.setItem(OFFLINE_ATTENDANCE_QUEUE_KEY, JSON.stringify(remaining))
      updateOfflineCount()

      if (remaining.length === 0) {
        setFeedback({
          type: "success",
          message: t("syncComplete", "Tout prezans ki te bloke yo senkronize avèk siksè!"),
        })
      }
    } catch (err) {
      console.error("Erro na sincronização:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId),
    [classes, selectedClassId]
  )

  if (loading && classes.length === 0) {
    return <LoadingState message={t("common.loading", "Chaje...")} />
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("professorAttendance", "Fèy Apèl ak Prezans")}
        subtitle={t("attendanceSubtitle", "Mak prezans elèv yo an tan reyèl")}
      />

      {feedback && (
        <Feedback
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {pendingSyncCount > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <span>
            ⚠️ <strong>{pendingSyncCount}</strong> {t("pendingSync", "apèl ap tann senkronizasyon sou aparèy sa a.")}
          </span>
          <Button size="sm" variant="outline" onClick={syncOfflineQueue} disabled={submitting}>
            {t("syncNow", "Senkronize kounye a")}
          </Button>
        </div>
      )}

      {/* Barra de Filtro de Turma e Data */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
            {t("class", "Klas")}
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.level || ""})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
            {t("date", "Dat")}
          </label>
          <input
            type="date"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="flex items-end">
          <Button
            variant="primary"
            className="w-full"
            onClick={submitAttendance}
            disabled={submitting || attendanceRecords.length === 0}
          >
            {submitting ? t("saving", "Ap anrejistre...") : t("submitAttendance", "Anrejistre Prezans")}
          </Button>
        </div>
      </div>

      {/* Lista de Presença de Alunos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <SkeletonLoader rows={5} />
          </div>
        ) : attendanceRecords.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {t("noStudentsInClass", "Pa gen elèv ki enskri nan klas sa a pou kounye a.")}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {attendanceRecords.map((item, idx) => {
              const studentName =
                item.student?.name ||
                `${item.student?.firstName || ""} ${item.student?.lastName || ""}`.trim() ||
                item.name ||
                `Elèv #${idx + 1}`

              return (
                <div key={item.studentId || item.id || idx} className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{sanitizeText(studentName)}</p>
                    <span className="text-xs text-slate-400">
                      {item.student?.enrollmentNumber || item.enrollmentNumber || "Matrikil N/A"}
                    </span>
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    {statusOptions.map((opt) => {
                      const isSelected = (item.status || "PRESENT") === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleStatusChange(item.studentId || item.id, opt.value)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            isSelected
                              ? opt.value === "PRESENT"
                                ? "bg-emerald-600 text-white shadow-sm"
                                : opt.value === "ABSENT"
                                ? "bg-rose-600 text-white shadow-sm"
                                : opt.value === "LATE"
                                ? "bg-amber-500 text-white shadow-sm"
                                : "bg-sky-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfessorAttendance