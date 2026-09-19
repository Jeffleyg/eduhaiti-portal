import { useState, useEffect, useMemo } from "react"
import AdminSectionToolbar from "../../components/AdminSectionToolbar.jsx"
import { useTranslation } from "react-i18next"
import { sanitizeText, maskName } from "../../lib/string.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import LoadMoreList from "../../components/LoadMoreList.jsx"
import "../styles/AdminClasses.css"

export default function AdminClasses() {
  const { t } = useTranslation()
  const { user, token } = useAuth()
  const [classes, setClasses] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [activeSection, setActiveSection] = useState("list")
  const [editingId, setEditingId] = useState(null)

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

  // Carregar turmas e dependências
  useEffect(() => {
    if (user?.role === "ADMIN") {
      void (async () => {
        try {
          const [classesRes, yearsRes, seriesRes, teachersRes] = await Promise.allSettled([
            apiFetch("/admin/classes", { token }),
            apiFetch("/admin/academic-years", { token }).catch(() => []),
            apiFetch("/admin/series", { token }).catch(() => []),
            apiFetch("/admin/teachers", { token }).catch(async () => apiFetch("/teachers", { token })),
          ])

          if (classesRes.status === "fulfilled") {
            setClasses(classesRes.value || [])
          }
          if (yearsRes.status === "fulfilled" && Array.isArray(yearsRes.value)) {
            setLoadedYears(yearsRes.value)
          }
          if (seriesRes.status === "fulfilled" && Array.isArray(seriesRes.value)) {
            setLoadedSeries(seriesRes.value)
          }
          if (teachersRes.status === "fulfilled" && Array.isArray(teachersRes.value)) {
            setLoadedTeachers(teachersRes.value)
          }
        } catch (error) {
          console.error("Failed to load classes and dependencies:", error)
        }
      })()
    }
  }, [user, token])

  // Extrai opções dos dados recebidos ou das próprias turmas existentes (fallback seguro)
  const academicYears = useMemo(() => {
    const map = new Map()
    loadedYears.forEach((y) => map.set(y.id, y.year || y.name || y.id))
    classes.forEach((c) => {
      const id = c.academicYearId || c.academicYear?.id
      const label = c.academicYear?.year || c.academicYear?.name || id
      if (id && !map.has(id)) map.set(id, label)
    })
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [loadedYears, classes])

  const seriesList = useMemo(() => {
    const map = new Map()
    loadedSeries.forEach((s) => map.set(s.id, s.name || s.id))
    classes.forEach((c) => {
      const id = c.seriesId || c.series?.id
      const label = c.series?.name || id
      if (id && !map.has(id)) map.set(id, label)
    })
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [loadedSeries, classes])

  const teachersList = useMemo(() => {
    const map = new Map()
    loadedTeachers.forEach((tc) =>
      map.set(tc.id, tc.name || `${tc.firstName || ""} ${tc.lastName || ""}`.trim() || tc.email || tc.id)
    )
    classes.forEach((c) => {
      const id = c.teacherId || c.teacher?.id
      const label = c.teacher?.name || `${c.teacher?.firstName || ""} ${c.teacher?.lastName || ""}`.trim() || id
      if (id && !map.has(id)) map.set(id, label)
    })
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [loadedTeachers, classes])

  // Preenche o formulário para edição
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
        // Modo Edição: Tenta PUT e faz fallback para PATCH
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
        // Modo Criação
        const response = await apiFetch("/admin/classes", {
          method: "POST",
          token,
          body: formData,
        })
        setClasses((prev) => [...prev, response])
      }

      handleCancelEdit()
    } catch (error) {
      console.error("Failed to save class:", error)
      alert(t("saveClassError") || "Erro ao salvar turma")
    }
  }

  const handleDelete = async (classId) => {
    if (confirm(t("confirmDeleteClass") || "Tem certeza que deseja deletar esta turma?")) {
      try {
        await apiFetch(`/admin/classes/${classId}`, { method: "DELETE", token })
        setClasses((prev) => prev.filter((c) => c.id !== classId))
      } catch (error) {
        console.error("Failed to delete class:", error)
        alert(t("deleteClassError") || "Erro ao deletar turma")
      }
    }
  }

  return (
    <div className="admin-classes">
      <h1>📚 {t("adminClassManagementTitle")}</h1>

      <div className="flex items-center justify-between gap-4">
        <AdminSectionToolbar
          sections={[
            { key: "list", label: t("adminClassList") },
            { key: "filters", label: t("adminClassFilters") },
            { key: "create", label: editingId ? t("adminEditClass") || "Modifier la classe" : t("adminCreateClass") },
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

      {activeSection === "create" && (
        <form onSubmit={handleSubmit} className="form-container">
          <input
            type="text"
            placeholder={t("classNamePlaceholder") || "Nom de la classe (ex: 3eme-A)"}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <select
            value={formData.academicYearId}
            onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
            required
          >
            <option value="">{t("selectAcademicYear")}</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </select>

          <select
            value={formData.seriesId}
            onChange={(e) => setFormData({ ...formData, seriesId: e.target.value })}
            required
          >
            <option value="">{t("adminSelectSeriesOption")}</option>
            {seriesList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={formData.teacherId}
            onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
          >
            <option value="">{t("adminSelectTeacherOptional")}</option>
            {teachersList.map((tc) => (
              <option key={tc.id} value={tc.id}>
                {tc.label}
              </option>
            ))}
          </select>

          <input
            type="number"
            placeholder={t("adminMaxStudents")}
            value={formData.maxStudents}
            onChange={(e) => setFormData({ ...formData, maxStudents: parseInt(e.target.value) || 30 })}
            min="1"
            max="50"
          />

          <div className="flex gap-2">
            <button type="submit" className="btn btn-success">
              ✓ {editingId ? t("adminUpdate") || "Atualizar" : t("adminCreateClass")}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
                {t("cancel") || "Annuler"}
              </button>
            )}
          </div>
        </form>
      )}

      {activeSection === "list" &&
        (classes.length === 0 ? (
          <p className="no-data">{t("noClasses")}</p>
        ) : (
          <LoadMoreList
            items={classes}
            initialLimit={6}
            step={6}
            renderItem={(cls) => (
              <div key={cls.id} className="class-card">
                <h3>{sanitizeText(cls.name)}</h3>
                <p>
                  <strong>{t("teacherLabel")}</strong> {maskName(cls.teacher?.name, "teacher") || t("adminNoTeacher")}
                </p>
                <p>
                  <strong>{t("studentsLabel")}</strong> {cls.students?.length || 0} / {cls.maxStudents}
                </p>
                <p>
                  <strong>{t("seriesLabel")}</strong> {sanitizeText(cls.series?.name) || "-"}
                </p>
                <div className="actions">
                  <button className="btn btn-sm btn-info" onClick={() => handleEdit(cls)}>
                    {t("adminEdit")}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(cls.id)}>
                    {t("adminDelete")}
                  </button>
                </div>
              </div>
            )}
          />
        ))}
    </div>
  )
}