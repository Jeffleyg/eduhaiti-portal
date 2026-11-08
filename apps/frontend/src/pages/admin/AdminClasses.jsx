import { useState, useEffect, useMemo } from "react"
import AdminSectionToolbar from "../../components/AdminSectionToolbar.jsx"
import { useTranslation } from "react-i18next"
import { sanitizeText, maskName } from "../../lib/string.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import LoadMoreList from "../../components/LoadMoreList.jsx"
import "../styles/AdminClasses.css"

// Utilitário para extrair array de respostas diretas ou objetos ({ data: [...] }, { years: [...] })
function extractArray(res) {
  if (!res) return []
  if (Array.isArray(res)) return res
  if (Array.isArray(res.data)) return res.data
  if (Array.isArray(res.years)) return res.years
  if (Array.isArray(res.academicYears)) return res.academicYears
  if (Array.isArray(res.items)) return res.items
  if (Array.isArray(res.rows)) return res.rows
  return []
}

export default function AdminClasses() {
  const { t } = useTranslation()
  const { user, token } = useAuth()

  const [classes, setClasses] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [activeSection, setActiveSection] = useState("list")
  const [editingId, setEditingId] = useState(null)

  // Filtros de listagem
  const [filterYearId, setFilterYearId] = useState("")
  const [filterSeriesId, setFilterSeriesId] = useState("")

  const [loadedYears, setLoadedYears] = useState([])
  const [loadedSeries, setLoadedSeries] = useState([])
  const [loadedTeachers, setLoadedTeachers] = useState([])

  const [formData, setFormData] = useState({
    name: "",
    academicYearId: "",
    seriesId: "",
    teacherId: "",
    maxStudents: 30,
  })

  // Carregar turmas e dependências com contingência de rotas
  useEffect(() => {
    if (user?.role === "ADMIN") {
      void (async () => {
        try {
          // Busca anos acadêmicos tentando as rotas possíveis no backend
          const fetchYears = async () => {
            const routes = [
              "/academic-admin/years",
              "/admin/academic-years",
              "/academic-years",
              "/academic-admin/academic-years",
            ]
            for (const route of routes) {
              try {
                const res = await apiFetch(route, { token })
                const list = extractArray(res)
                if (list.length > 0) return list
                if (Array.isArray(res) || res?.data) return list
              } catch {
                // Tenta próxima rota
              }
            }
            return []
          }

          // Busca séries
          const fetchSeries = async () => {
            const routes = ["/admin/series", "/academic-admin/series", "/series"]
            for (const route of routes) {
              try {
                const res = await apiFetch(route, { token })
                const list = extractArray(res)
                if (list.length > 0 || Array.isArray(res) || res?.data) return list
              } catch {
                // Tenta próxima rota
              }
            }
            return []
          }

          // Busca professores
          const fetchTeachers = async () => {
            const routes = ["/admin/teachers", "/teachers", "/admin/users?role=TEACHER"]
            for (const route of routes) {
              try {
                const res = await apiFetch(route, { token })
                const list = extractArray(res)
                if (list.length > 0 || Array.isArray(res) || res?.data) return list
              } catch {
                // Tenta próxima rota
              }
            }
            return []
          }

          const [classesRes, yearsList, seriesListRes, teachersListRes] = await Promise.allSettled([
            apiFetch("/admin/classes", { token }),
            fetchYears(),
            fetchSeries(),
            fetchTeachers(),
          ])

          if (classesRes.status === "fulfilled") {
            setClasses(extractArray(classesRes.value))
          }
          if (yearsList.status === "fulfilled") {
            setLoadedYears(yearsList.value || [])
          }
          if (seriesListRes.status === "fulfilled") {
            setLoadedSeries(seriesListRes.value || [])
          }
          if (teachersListRes.status === "fulfilled") {
            setLoadedTeachers(teachersListRes.value || [])
          }
        } catch (error) {
          console.error("Erro ao carregar turmas e dependências:", error)
        }
      })()
    }
  }, [user, token])

  // Normaliza anos acadêmicos com suporte a id, year, name, code e isActive
  const academicYears = useMemo(() => {
    const map = new Map()
    loadedYears.forEach((y) => {
      const id = y.id || y._id
      const label = y.year || y.name || y.code || y.title || id
      if (id) {
        map.set(id, y.isActive ? `${label} (${t("currentYear", "Actuelle")})` : label)
      }
    })

    // Fallback com as turmas já carregadas
    classes.forEach((c) => {
      const id = c.academicYearId || c.academicYear?.id
      const label = c.academicYear?.year || c.academicYear?.name || id
      if (id && !map.has(id)) map.set(id, label)
    })

    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [loadedYears, classes, t])

  const seriesList = useMemo(() => {
    const map = new Map()
    loadedSeries.forEach((s) => {
      const id = s.id || s._id
      const label = s.name || s.code || id
      if (id) map.set(id, label)
    })

    classes.forEach((c) => {
      const id = c.seriesId || c.series?.id
      const label = c.series?.name || id
      if (id && !map.has(id)) map.set(id, label)
    })

    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [loadedSeries, classes])

  const teachersList = useMemo(() => {
    const map = new Map()
    loadedTeachers.forEach((tc) => {
      const id = tc.id || tc._id
      const label = tc.name || `${tc.firstName || ""} ${tc.lastName || ""}`.trim() || tc.email || id
      if (id) map.set(id, label)
    })

    classes.forEach((c) => {
      const id = c.teacherId || c.teacher?.id
      const label = c.teacher?.name || `${c.teacher?.firstName || ""} ${c.teacher?.lastName || ""}`.trim() || id
      if (id && !map.has(id)) map.set(id, label)
    })

    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [loadedTeachers, classes])

  // Filtragem das turmas listadas
  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      const classYearId = cls.academicYearId || cls.academicYear?.id
      const classSeriesId = cls.seriesId || cls.series?.id

      const matchesYear = !filterYearId || classYearId === filterYearId
      const matchesSeries = !filterSeriesId || classSeriesId === filterSeriesId

      return matchesYear && matchesSeries
    })
  }, [classes, filterYearId, filterSeriesId])

  // Iniciar edição
  const handleEdit = (cls) => {
    setEditingId(cls.id)
    setFormData({
      name: cls.name || "",
      academicYearId: cls.academicYearId || cls.academicYear?.id || "",
      seriesId: cls.seriesId || cls.series?.id || "",
      teacherId: cls.teacherId || cls.teacher?.id || "",
      maxStudents: cls.maxStudents || 30,
    })
    setActiveSection("create")
    setShowForm(true)
  }

  // Cancelar edição
  const handleCancelEdit = () => {
    setEditingId(null)
    setFormData({
      name: "",
      academicYearId: "",
      seriesId: "",
      teacherId: "",
      maxStudents: 30,
    })
    setActiveSection("list")
    setShowForm(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingId) {
        let updatedClass
        try {
          updatedClass = await apiFetch(`/admin/classes/${editingId}`, {
            method: "PUT",
            token,
            body: formData,
          })
        } catch {
          updatedClass = await apiFetch(`/admin/classes/${editingId}`, {
            method: "PATCH",
            token,
            body: formData,
          })
        }

        setClasses((prev) =>
          prev.map((c) =>
            c.id === editingId
              ? {
                  ...c,
                  ...(updatedClass || {}),
                  name: formData.name,
                  maxStudents: formData.maxStudents,
                  academicYearId: formData.academicYearId,
                  seriesId: formData.seriesId,
                  teacherId: formData.teacherId,
                  teacher: teachersList.find((t) => t.id === formData.teacherId)
                    ? { name: teachersList.find((t) => t.id === formData.teacherId).label }
                    : c.teacher,
                  series: seriesList.find((s) => s.id === formData.seriesId)
                    ? { name: seriesList.find((s) => s.id === formData.seriesId).label }
                    : c.series,
                }
              : c
          )
        )
      } else {
        const response = await apiFetch("/admin/classes", {
          method: "POST",
          token,
          body: formData,
        })
        setClasses((prev) => [...prev, response])
      }

      handleCancelEdit()
    } catch (error) {
      console.error("Erro ao salvar turma:", error)
      alert(t("saveClassError") || "Erro ao salvar turma")
    }
  }

  const handleDelete = async (classId) => {
    if (confirm(t("confirmDeleteClass") || "Tem certeza que deseja deletar esta turma?")) {
      try {
        await apiFetch(`/admin/classes/${classId}`, { method: "DELETE", token })
        setClasses((prev) => prev.filter((c) => c.id !== classId))
      } catch (error) {
        console.error("Erro ao deletar turma:", error)
        alert(t("deleteClassError") || "Erro ao deletar turma")
      }
    }
  }

  return (
    <div className="admin-classes space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">📚 {t("adminClassManagementTitle", "Gestion des Classes")}</h1>
        <p className="text-xs text-slate-500 mt-1">
          {t("adminClassSubtitle", "Créez et gérez les classes de l'établissement.")}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <AdminSectionToolbar
          sections={[
            { key: "list", label: t("adminClassList", "Lis klas yo") },
            { key: "filters", label: t("adminClassFilters", "Filtres") },
            { key: "create", label: editingId ? t("adminEditClass", "Modifier la classe") : t("adminCreateClass", "Créer une classe") },
          ]}
          active={activeSection}
          onChange={(k) => {
            setActiveSection(k)
            setShowForm(k === "create")
            if (k !== "create") {
              setEditingId(null)
            }
          }}
        />
      </div>

      {/* Painel de Filtros */}
      {activeSection === "filters" && (
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
              {t("selectAcademicYear", "Choisir l'année académique")}
            </label>
            <select
              value={filterYearId}
              onChange={(e) => setFilterYearId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
            >
              <option value="">{t("allYears", "Toutes les années académiques")}</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
              {t("adminSelectSeriesOption", "Toutes les séries")}
            </label>
            <select
              value={filterSeriesId}
              onChange={(e) => setFilterSeriesId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
            >
              <option value="">{t("allSeries", "Toutes les séries")}</option>
              {seriesList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Formulário de Criação / Edição */}
      {activeSection === "create" && (
        <form onSubmit={handleSubmit} className="form-container bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              {t("className", "Nom de la Classe")} *
            </label>
            <input
              type="text"
              placeholder={t("classNamePlaceholder") || "Ex: 3eme-A"}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                {t("selectAcademicYear", "Année Académique")} *
              </label>
              <select
                value={formData.academicYearId}
                onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
              >
                <option value="">{t("selectAcademicYear", "Choisir l'année académique")}</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                {t("seriesLabel", "Série / Niveau")} *
              </label>
              <select
                value={formData.seriesId}
                onChange={(e) => setFormData({ ...formData, seriesId: e.target.value })}
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
              >
                <option value="">{t("adminSelectSeriesOption", "Sélectionner la série")}</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                {t("teacherLabel", "Professeur Titulaire")}
              </label>
              <select
                value={formData.teacherId}
                onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
              >
                <option value="">{t("adminSelectTeacherOptional", "Sélectionner un professeur (optionnel)")}</option>
                {teachersList.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                {t("adminMaxStudents", "Capacité Max")}
              </label>
              <input
                type="number"
                placeholder="30"
                value={formData.maxStudents}
                onChange={(e) => setFormData({ ...formData, maxStudents: parseInt(e.target.value) || 30 })}
                min="1"
                max="60"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn btn-success">
              ✓ {editingId ? t("adminUpdate", "Mettre à jour") : t("adminCreateClass", "Créer la classe")}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
                {t("cancel", "Annuler")}
              </button>
            )}
          </div>
        </form>
      )}

      {/* Listagem de Turmas */}
      {activeSection === "list" &&
        (filteredClasses.length === 0 ? (
          <p className="no-data p-6 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
            {t("noClasses", "Aucune classe trouvée.")}
          </p>
        ) : (
          <LoadMoreList
            items={filteredClasses}
            initialLimit={6}
            step={6}
            renderItem={(cls) => (
              <div key={cls.id} className="class-card">
                <h3>{sanitizeText(cls.name)}</h3>
                <p>
                  <strong>{t("teacherLabel", "Pwofesè")}:</strong>{" "}
                  {maskName(cls.teacher?.name, "teacher") || t("adminNoTeacher", "Aucun")}
                </p>
                <p>
                  <strong>{t("studentsLabel", "Elèv")}:</strong> {cls.students?.length || 0} / {cls.maxStudents}
                </p>
                <p>
                  <strong>{t("seriesLabel", "Série")}:</strong> {sanitizeText(cls.series?.name) || "-"}
                </p>
                <div className="actions">
                  <button className="btn btn-sm btn-info" onClick={() => handleEdit(cls)}>
                    {t("adminEdit", "Modifier")}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(cls.id)}>
                    {t("adminDelete", "Supprimer")}
                  </button>
                </div>
              </div>
            )}
          />
        ))}
    </div>
  )
}