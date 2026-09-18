import { useState, useEffect } from "react"
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

  const [formData, setFormData] = useState({
    name: "",
    academicYearId: "",
    seriesId: "",
    teacherId: "",
    maxStudents: 30,
  })

  useEffect(() => {
    if (user?.role === "ADMIN") {
      void (async () => {
        try {
          const classesRes = await apiFetch("/admin/classes", { token })
          setClasses(classesRes || [])
        } catch (error) {
          console.error("Failed to load classes:", error)
        }
      })()
    }
  }, [user, token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const response = await apiFetch("/admin/classes", {
        method: "POST",
        token,
        body: formData,
      })

      setClasses([...classes, response])
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
      alert(t("createClassError") || "Erro ao criar turma")
    }
  }

  const handleDelete = async (classId) => {
    if (confirm(t("confirmDeleteClass") || "Tem certeza que deseja deletar esta turma?")) {
      try {
        await apiFetch(`/admin/classes/${classId}`, { method: "DELETE", token })
        setClasses(classes.filter((c) => c.id !== classId))
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
            sections={[{ key: "list", label: t("adminClassList") }, { key: "filters", label: t("adminClassFilters") }, { key: "create", label: t("adminCreateClass") }]}
          active={activeSection}
          onChange={(k) => {
            setActiveSection(k)
            setShowForm(k === "create")
          }}
        />
      </div>
      {activeSection === "create" && (
        <form onSubmit={handleSubmit} className="form-container">
          <input
            type="text"
            placeholder={t("classNamePlaceholder")}
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
              <option value="">{t("selectAcademicYear")}</option>
          </select>

          <select
            value={formData.seriesId}
            onChange={(e) =>
              setFormData({ ...formData, seriesId: e.target.value })
            }
            required
          >
            <option value="">{t("adminSelectSeriesOption")}</option>
          </select>

          <select
            value={formData.teacherId}
            onChange={(e) =>
              setFormData({ ...formData, teacherId: e.target.value })
            }
          >
            <option value="">{t("adminSelectTeacherOptional")}</option>
          </select>

          <input
            type="number"
            placeholder={t("adminMaxStudents")}
            value={formData.maxStudents}
            onChange={(e) =>
              setFormData({ ...formData, maxStudents: parseInt(e.target.value) })
            }
            min="1"
            max="50"
          />

          <button type="submit" className="btn btn-success">
            ✓ {t("adminCreateClass")}
          </button>
        </form>
      )}

      {activeSection === "list" && (classes.length === 0 ? (
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
                <strong>{t("studentsLabel")}</strong> {cls.students?.length || 0} /{" "}
                {cls.maxStudents}
              </p>
              <p>
                <strong>{t("seriesLabel")}</strong> {sanitizeText(cls.series?.name) || "-"}
              </p>
              <div className="actions">
                <button className="btn btn-sm btn-info">{t("adminEdit")}</button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(cls.id)}
                >
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
