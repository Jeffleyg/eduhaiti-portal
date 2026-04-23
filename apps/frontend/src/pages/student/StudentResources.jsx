import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiAssetUrl, apiFetch } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"
import { useSurvivalMode } from "../../context/useSurvivalMode.js"

function StudentResources() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const { disableImages } = useSurvivalMode()
  const [resources, setResources] = useState([])
  const [libraryResources, setLibraryResources] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const classesRes = await apiFetch("/classes/my-classes", { token })
        setClasses(classesRes ?? [])

        if (classesRes && classesRes.length > 0) {
          const allResources = []
          for (const cls of classesRes) {
            const resourcesRes = await apiFetch(`/resources/class/${cls.id}`, { token })
            allResources.push(...(resourcesRes ?? []))
          }
          setResources(allResources)

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

  if (loading) {
    return <div className="text-center text-brand-navy">{t("loading")}</div>
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Recursos de Aula"
        subtitle={
          disableImages
            ? "Modo texto ativo para economizar bateria e dados."
            : "PDFs, slides e documentos compartilhados pelos professores"
        }
      />

      <div className="space-y-3">
        {resources.length > 0 ? (
          resources.map((resource) => (
            <div key={resource.id} className="rounded-2xl border border-brand-navy/10 bg-white p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-brand-navy">{resource.title}</p>
                {disableImages ? null : <p className="text-sm text-brand-navy/60">{resource.description}</p>}
                <p className="text-xs text-brand-navy/50 mt-1">Por: {resource.uploadedBy?.name}</p>
              </div>
              <a href={apiAssetUrl(resource.filePath)} download className="text-brand-red font-semibold hover:underline whitespace-nowrap">
                {disableImages ? "TXT-DOWNLOAD" : "Download"}
              </a>
            </div>
          ))
        ) : (
          <p className="text-center text-brand-navy/60">Nenhum recurso disponível</p>
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
              <a href={apiAssetUrl(resource.filePath)} download className="text-brand-red font-semibold hover:underline whitespace-nowrap">
                {disableImages ? "TXT-DOWNLOAD" : "Download"}
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

export default StudentResources
