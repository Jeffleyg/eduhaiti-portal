import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiAssetUrl, apiFetch, apiUpload } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"
import { Upload } from "lucide-react"
import { useSurvivalMode } from "../../context/useSurvivalMode.js"

function ProfessorResources() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const { disableImages } = useSurvivalMode()
  const [resources, setResources] = useState([])
  const [libraryResources, setLibraryResources] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedClass, setSelectedClass] = useState("")
  const [formData, setFormData] = useState({ title: "", description: "" })
  const [file, setFile] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const classesRes = await apiFetch("/classes/my-classes", { token })
        setClasses(classesRes ?? [])
        if (classesRes && classesRes[0]) {
          setSelectedClass(classesRes[0].id)
          const resourcesRes = await apiFetch(`/resources/class/${classesRes[0].id}`, { token })
          setResources(resourcesRes ?? [])

          const uniqueSeriesIds = [...new Set((classesRes ?? []).map((item) => item.series?.id).filter(Boolean))]
          const libraryResponses = await Promise.all(
            uniqueSeriesIds.map((seriesId) => apiFetch(`/resources/library/series/${seriesId}`, { token })),
          )
          const merged = libraryResponses.flat()
          const deduped = [...new Map(merged.map((item) => [item.id, item])).values()]
          setLibraryResources(deduped)
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [token])

  const loadResourcesForClass = async (classId) => {
    try {
      const resourcesRes = await apiFetch(`/resources/class/${classId}`, { token })
      setResources(resourcesRes ?? [])
    } catch (error) {
      console.error("Failed to fetch resources:", error)
    }
  }

  const handleClassChange = (e) => {
    const classId = e.target.value
    setSelectedClass(classId)
    loadResourcesForClass(classId)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file || !selectedClass) return

    setUploading(true)
    try {
      const formDataToSend = new FormData()
      formDataToSend.append("file", file)
      formDataToSend.append("title", formData.title)
      formDataToSend.append("description", formData.description)

      await apiUpload(`/resources/upload/${selectedClass}`, {
        method: "POST",
        token,
        formData: formDataToSend,
      })
      setFormData({ title: "", description: "" })
      setFile(null)
      loadResourcesForClass(selectedClass)
    } catch (error) {
      console.error("Upload failed:", error)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div className="text-center text-brand-navy">{t("loading")}</div>
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Gerenciar Recursos"
        subtitle={
          disableImages
            ? "Modo texto ativo: interface simplificada para baixo consumo."
            : "Compartilhe PDFs, slides e documentos com sua turma"
        }
      />

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
        <h3 className="font-semibold text-brand-navy">Enviar Novo Recurso</h3>

        <div>
          <label className="block text-sm font-semibold text-brand-navy mb-2">Título</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            className="w-full px-4 py-2 border border-brand-navy/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red"
            placeholder="Ex: Aula 01 - Matemática"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-brand-navy mb-2">Descrição (opcional)</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border border-brand-navy/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red"
            placeholder="Descrição do material"
            rows={3}
          />
        </div>

        <div className="border-2 border-dashed border-brand-navy/20 rounded-xl p-6 text-center cursor-pointer hover:border-brand-red transition">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0])}
            className="hidden"
            id="file-input"
            accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx"
          />
          <label htmlFor="file-input" className="cursor-pointer flex flex-col items-center gap-2">
            {disableImages ? null : <Upload className="w-6 h-6 text-brand-navy/60" />}
            <span className="text-sm font-semibold text-brand-navy">{file ? file.name : t("clickToUpload")}</span>
            {disableImages ? null : <span className="text-xs text-brand-navy/60">PDF, PowerPoint, Word, Excel</span>}
          </label>
        </div>

        <button
          type="submit"
          disabled={uploading || !file || !formData.title}
          className="w-full py-3 bg-gradient-to-r from-brand-red to-brand-red hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
        >
          {uploading ? "Enviando..." : "Enviar Recurso"}
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="font-semibold text-brand-navy">Recursos da Turma</h3>
        {resources.length > 0 ? (
          resources.map((resource) => (
            <div key={resource.id} className="rounded-2xl border border-brand-navy/10 bg-white p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-brand-navy">{resource.title}</p>
                {disableImages ? null : <p className="text-sm text-brand-navy/60">{resource.fileType.toUpperCase()}</p>}
              </div>
              <a href={apiAssetUrl(resource.filePath)} download className="text-brand-red font-semibold hover:underline">
                {disableImages ? "TXT-DOWNLOAD" : "Download"}
              </a>
            </div>
          ))
        ) : (
          <p className="text-center text-brand-navy/60">Nenhum recurso enviado ainda</p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-brand-navy">Biblioteca Digital da Serie</h3>
        {libraryResources.length > 0 ? (
          libraryResources.map((resource) => (
            <div key={resource.id} className="rounded-2xl border border-brand-navy/10 bg-white p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-brand-navy">{resource.title}</p>
                <p className="text-xs text-brand-navy/60">Turma: {resource.class?.name ?? "-"}</p>
              </div>
              <a href={apiAssetUrl(resource.filePath)} download className="text-brand-red font-semibold hover:underline">
                Download
              </a>
            </div>
          ))
        ) : (
          <p className="text-center text-brand-navy/60">Sem itens na biblioteca da serie.</p>
        )}
      </div>
    </div>
  )
}

export default ProfessorResources
