import { useEffect, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import SectionCard from "../../components/SectionCard.jsx"
import SchoolContext from "../../components/admin/SchoolContext.jsx"
import PeriodForm from "../../components/admin/PeriodForm.jsx"
import PeriodsList from "../../components/admin/PeriodsList.jsx"
import SettingsForm from "../../components/admin/SettingsForm.jsx"
import Feedback from "../../components/Feedback.jsx"
import AdminSectionToolbar from "../../components/AdminSectionToolbar.jsx"
import Button from "../../components/Button.jsx"
import { Calendar, Layers, Clock, Settings, Building2, Trash2, CheckCircle2 } from "lucide-react"

const initialPeriod = {
  name: "",
  startDate: "",
  endDate: "",
  description: "",
}

const initialSettings = {
  passAverage: 10,
  maxAbsencesPerCourse: 5,
  assignmentLateDaysLimit: 2,
  gradeReviewWindowDays: 7,
}

export default function AdminAcademicConfig() {
  const { t } = useTranslation()
  const { token, user } = useAuth()
  const [schoolId, setSchoolId] = useState(user?.schoolId || "")
  const [activeSection, setActiveSection] = useState("years") // Abre direto no Ano Académico

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  // Estados dos Anos Académicos
  const [years, setYears] = useState([])
  const [yearForm, setYearForm] = useState({ year: "2026-2027", startDate: "", endDate: "", isActive: true })

  // Estados das Séries
  const [seriesList, setSeriesList] = useState([])
  const [seriesForm, setSeriesForm] = useState({ name: "", code: "" })

  // Estados dos Períodos e Configurações
  const [periods, setPeriods] = useState([])
  const [periodForm, setPeriodForm] = useState(initialPeriod)
  const [settingsForm, setSettingsForm] = useState(initialSettings)

  const clearFeedback = () => {
    setError("")
    setMessage("")
  }

  // 1. Carregar Anos Académicos da Escola
  const loadYears = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiFetch("/admin/academic-years", { token })
      const list = Array.isArray(res) ? res : res?.data || res?.academicYears || []
      setYears(list)
    } catch (err) {
      console.error("Erro ao carregar anos:", err)
    } finally {
      setLoading(false)
    }
  }, [token])

  // 2. Carregar Séries da Escola
  const loadSeries = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiFetch("/admin/series", { token })
      const list = Array.isArray(res) ? res : res?.data || []
      setSeriesList(list)
    } catch (err) {
      console.error("Erro ao carregar séries:", err)
    } finally {
      setLoading(false)
    }
  }, [token])

  // 3. Carregar Períodos
  const loadPeriods = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiFetch("/admin/academic-periods", { token })
      const list = Array.isArray(res) ? res : res?.data || []
      setPeriods(list)
    } catch (err) {
      console.error("Erro ao carregar períodos:", err)
    } finally {
      setLoading(false)
    }
  }, [token])

  // 4. Carregar Configurações de Média
  const loadSettings = useCallback(async () => {
    if (!user?.schoolId) return
    try {
      const data = await apiFetch(`/admin/academic-settings/${encodeURIComponent(user.schoolId)}`, { token })
      if (data) {
        setSettingsForm({
          passAverage: Number(data.passAverage ?? 10),
          maxAbsencesPerCourse: Number(data.maxAbsencesPerCourse ?? 5),
          assignmentLateDaysLimit: Number(data.assignmentLateDaysLimit ?? 2),
          gradeReviewWindowDays: Number(data.gradeReviewWindowDays ?? 7),
        })
      }
    } catch (err) {
      console.error("Erro ao carregar configurações:", err)
    }
  }, [user?.schoolId, token])

  useEffect(() => {
    loadYears()
    loadSeries()
    loadPeriods()
    loadSettings()
  }, [loadYears, loadSeries, loadPeriods, loadSettings])

  // ================= CADASTRO DE ANO ACADÉMICO =================
  const handleCreateYear = async (e) => {
    e.preventDefault()
    clearFeedback()
    try {
      setLoading(true)
      await apiFetch("/admin/academic-years", {
        method: "POST",
        token,
        body: {
          year: yearForm.year.trim(),
          startDate: yearForm.startDate || undefined,
          endDate: yearForm.endDate || undefined,
          isActive: yearForm.isActive,
        },
      })
      setMessage(t("academicYearSaved"))
      setYearForm({ year: "", startDate: "", endDate: "", isActive: true })
      await loadYears()
    } catch (err) {
      setError(err.message || t("academicYearCreateError"))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteYear = async (yearId) => {
    if (!window.confirm(t("academicYearDeleteConfirm"))) return
    try {
      await apiFetch(`/admin/academic-years/${yearId}`, { method: "DELETE", token })
      setMessage(t("academicYearDeleted"))
      await loadYears()
    } catch (err) {
      setError(err.message || t("academicYearDeleteError"))
    }
  }

  // ================= CADASTRO DE SÉRIE / NÍVEL =================
  const handleCreateSeries = async (e) => {
    e.preventDefault()
    clearFeedback()
    try {
      setLoading(true)
      await apiFetch("/admin/series", {
        method: "POST",
        token,
        body: {
          name: seriesForm.name.trim(),
          code: seriesForm.code.trim() || undefined,
        },
      })
      setMessage(t("seriesSaved"))
      setSeriesForm({ name: "", code: "" })
      await loadSeries()
    } catch (err) {
      setError(err.message || t("seriesCreateError"))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSeries = async (seriesId) => {
    if (!window.confirm(t("seriesDeleteConfirm"))) return
    try {
      await apiFetch(`/admin/series/${seriesId}`, { method: "DELETE", token })
      setMessage(t("seriesDeleted"))
      await loadSeries()
    } catch (err) {
      setError(err.message || t("seriesDeleteError"))
    }
  }

  // ================= CRIAÇÃO DE PERÍODO =================
  const handleCreatePeriod = async (e) => {
    e.preventDefault()
    clearFeedback()
    try {
      setLoading(true)
      await apiFetch("/admin/academic-periods", {
        method: "POST",
        token,
        body: {
          ...periodForm,
          schoolId: user?.schoolId,
        },
      })
      setPeriodForm(initialPeriod)
      setMessage(t("periodSaved"))
      await loadPeriods()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("academicAdminTitle", "Configuration Académique")}
        subtitle={t("academicConfigSubtitle")}
      />

      <Feedback error={error} message={message} />

      {/* Barra com as 5 abas */}
      <AdminSectionToolbar
        sections={[
          { key: "years", label: t("academicYearsTab") },
          { key: "series", label: t("seriesTab") },
          { key: "periods", label: t("periods", "Périodes") },
          { key: "settings", label: t("settings", "Paramètres") },
          { key: "context", label: t("schoolContext", "Contexte de l'École") },
        ]}
        active={activeSection}
        onChange={(k) => {
          clearFeedback()
          setActiveSection(k)
        }}
      />

      {/* ================= ABA 1: ANOS ACADÉMICOS ================= */}
      {activeSection === "years" && (
        <div className="space-y-6">
          <SectionCard>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-brand-navy">{t("academicYearCreateTitle")}</h3>
                <p className="text-xs text-brand-navy/60">{t("academicYearExample")}</p>
              </div>
            </div>

            <form onSubmit={handleCreateYear} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-brand-navy uppercase mb-1">
                    {t("schoolYearRequiredLabel")}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 2026-2027"
                    value={yearForm.year}
                    onChange={(e) => setYearForm({ ...yearForm, year: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-navy uppercase mb-1">
                    {t("startDate")}
                  </label>
                  <input
                    type="date"
                    value={yearForm.startDate}
                    onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-navy uppercase mb-1">
                    {t("endDate")}
                  </label>
                  <input
                    type="date"
                    value={yearForm.endDate}
                    onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-brand-navy cursor-pointer">
                  <input
                    type="checkbox"
                    checked={yearForm.isActive}
                    onChange={(e) => setYearForm({ ...yearForm, isActive: e.target.checked })}
                    className="w-4 h-4 accent-brand-navy rounded"
                  />
                  {t("academicYearSetActive")}
                </label>

                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? t("saving") : t("academicYearSaveAction")}
                </Button>
              </div>
            </form>
          </SectionCard>

          {/* Lista de Anos */}
          <SectionCard>
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-navy mb-4">
              {t("academicYearsSaved")}
            </h3>
            {years.length === 0 ? (
              <p className="text-xs text-slate-400">{t("academicYearsEmpty")}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {years.map((y) => (
                  <div key={y.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <strong className="text-sm text-brand-navy font-bold">{y.year || y.name}</strong>
                      {y.isActive && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> {t("active")}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteYear(y.id)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 transition-colors"
                      title={t("adminDelete")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ================= ABA 2: SÉRIES E NÍVEIS ================= */}
      {activeSection === "series" && (
        <div className="space-y-6">
          <SectionCard>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-brand-navy">{t("seriesCreateTitle")}</h3>
                <p className="text-xs text-brand-navy/60">{t("seriesExample")}</p>
              </div>
            </div>

            <form onSubmit={handleCreateSeries} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-brand-navy uppercase mb-1">
                    {t("seriesNameLabel")}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t("seriesNameExample")}
                    value={seriesForm.name}
                    onChange={(e) => setSeriesForm({ ...seriesForm, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-navy uppercase mb-1">
                    {t("seriesCodeLabel")}
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 3AF ou NS1"
                    value={seriesForm.code}
                    onChange={(e) => setSeriesForm({ ...seriesForm, code: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? t("saving") : t("seriesSaveAction")}
                </Button>
              </div>
            </form>
          </SectionCard>

          {/* Lista de Séries */}
          <SectionCard>
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-navy mb-4">
              {t("seriesSavedList")}
            </h3>
            {seriesList.length === 0 ? (
              <p className="text-xs text-slate-400">{t("seriesEmpty")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {seriesList.map((s) => (
                  <div key={s.id} className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between shadow-xs">
                    <div>
                      <strong className="text-xs font-bold text-brand-navy block">{s.name}</strong>
                      {s.code && <span className="text-[10px] text-slate-400 font-mono">{s.code}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSeries(s.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ================= ABA 3: PERÍODOS / TRIMESTRES ================= */}
      {activeSection === "periods" && (
        <div className="space-y-6">
          <SectionCard>
            <PeriodForm t={t} periodForm={periodForm} setPeriodForm={setPeriodForm} createPeriod={handleCreatePeriod} loading={loading} />
          </SectionCard>

          <SectionCard>
            <h3 className="text-base font-semibold text-brand-navy mb-4">{t("academicPeriodsList", "Périodes Académiques")}</h3>
            <PeriodsList
              t={t}
              periods={periods}
              togglePeriod={async (p) => {
                clearFeedback()
                try {
                  await apiFetch(`/admin/academic-periods/${p.id}/${p.isOpen ? "close" : "open"}`, { method: "PATCH", token })
                  await loadPeriods()
                } catch (err) {
                  setError(err.message || t("periodUpdateError"))
                }
              }}
              removePeriod={async (id) => {
                if (!window.confirm(t("periodDeleteConfirm"))) return
                clearFeedback()
                try {
                  await apiFetch(`/admin/academic-periods/${id}`, { method: "DELETE", token })
                  await loadPeriods()
                } catch (err) {
                  setError(err.message || t("periodDeleteError"))
                }
              }}
            />
          </SectionCard>
        </div>
      )}

      {/* ================= ABA 4: CONFIGURAÇÕES DE NOTAS E FALTAS ================= */}
      {activeSection === "settings" && (
        <SectionCard>
          <SettingsForm
            t={t}
            settingsForm={settingsForm}
            setSettingsForm={setSettingsForm}
            saveSettings={async (e) => {
              e.preventDefault()
              clearFeedback()
              try {
                await apiFetch(`/admin/academic-settings/${encodeURIComponent(user?.schoolId)}`, {
                  method: "PUT",
                  token,
                  body: settingsForm,
                })
                setMessage(t("settingsSavedSuccess"))
              } catch (err) {
                setError(err.message || t("settingsSaveError"))
              }
            }}
            loading={loading}
          />
        </SectionCard>
      )}

      {/* ================= ABA 5: CONTEXTO DA ESCOLA ================= */}
      {activeSection === "context" && (
        <SectionCard>
          <SchoolContext
            t={t}
            schoolId={schoolId}
            setSchoolId={setSchoolId}
            loadPeriods={loadPeriods}
            loadSettings={loadSettings}
            loading={loading}
            locked={true}
          />
        </SectionCard>
      )}
    </div>
  )
}