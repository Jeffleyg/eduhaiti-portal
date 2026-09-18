import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiAssetUrl, apiFetch } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"
import { sanitizeText, maskName } from "../../lib/string.js"
import { useSurvivalMode } from "../../context/useSurvivalMode.js"
import LoadMoreList from "../../components/LoadMoreList.jsx"
import {
  listOfflineAssets,
  removeOffline,
  saveAssetOffline,
} from "../../offline/offlineAssetLibrary.js"

function StudentResources() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const { disableImages } = useSurvivalMode()
  const [resources, setResources] = useState([])
  const [libraryResources, setLibraryResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [offlineAssets, setOfflineAssets] = useState(() => listOfflineAssets())
  const [savingId, setSavingId] = useState("")
  const [feedback, setFeedback] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const classesRes = await apiFetch("/classes/my-classes", { token })

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

  const isSavedOffline = (resourceId) => {
    return offlineAssets.some((item) => item.resourceId === resourceId)
  }

  const canCacheResource = (resource) => {
    const supported = ["pdf", "mp4", "webm", "doc", "ppt", "pptx"]
    return supported.includes(String(resource?.fileType || "").toLowerCase())
  }

  const handleSaveOffline = async (resource) => {
    const url = apiAssetUrl(resource.filePath)
    setFeedback("")
    setSavingId(resource.id)
    try {
      const next = await saveAssetOffline({
        id: resource.id,
        title: resource.title,
        fileType: resource.fileType,
        url,
      })
      setOfflineAssets(next)
      setFeedback(`"${resource.title}" salvo para acesso offline.`)
    } catch (error) {
      console.error("Failed to save offline asset:", error)
      setFeedback("Could not save offline. Please try again.")
    } finally {
      setSavingId("")
    }
  }

  const handleRemoveOffline = async (resource) => {
    const next = await removeOffline(resource.id, apiAssetUrl(resource.filePath))
    setOfflineAssets(next)
    setFeedback(`"${resource.title}" removido da biblioteca offline.`)
  }

  const renderResourceCard = (resource) => (
    <div key={resource.id} className="module-card compact p-3 bg-white border border-brand-navy/8">
      <div className="grid grid-cols-12 items-center gap-2">
        <div className="col-span-8">
          <p className="font-semibold text-sm text-brand-navy">{resource.title}</p>
          {disableImages ? null : <p className="text-xs text-brand-navy/70">{resource.description}</p>}
          <p className="text-xs text-brand-navy/60 mt-1">Por: {maskName(resource.uploadedBy?.name, "user")}</p>
        </div>
        <div className="col-span-4 flex items-center justify-end gap-2">
          <a href={apiAssetUrl(resource.filePath)} download className="text-brand-red text-sm font-semibold hover:underline whitespace-nowrap">
            {disableImages ? "TXT" : "Download"}
          </a>
          {canCacheResource(resource) ? (
            isSavedOffline(resource.id) ? (
              <button
                type="button"
                onClick={() => handleRemoveOffline(resource)}
                className="rounded-md border border-brand-navy/20 px-2 py-1 text-xs font-semibold text-brand-navy hover:bg-brand-navy/5"
              >
                Remover
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSaveOffline(resource)}
                disabled={savingId === resource.id}
                className="rounded-md bg-brand-navy px-2 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {savingId === resource.id ? "..." : "Salvar"}
              </button>
            )
          ) : null}
        </div>
      </div>
    </div>
  )

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

      {feedback ? <p className="text-sm text-brand-navy/80">{feedback}</p> : null}

      <div className="rounded-2xl border border-brand-navy/10 bg-sand p-4">
        <p className="text-sm text-brand-navy font-semibold">Biblioteca Offline</p>
        <p className="text-xs text-brand-navy/70 mt-1">
          Itens salvos: {offlineAssets.length}. Eles permanecem acessiveis mesmo sem internet no mesmo dispositivo.
        </p>
      </div>

      <div className="space-y-3">
        {resources.length > 0 ? (
          <LoadMoreList
            items={resources}
            initialLimit={4}
            step={4}
            renderItem={renderResourceCard}
          />
        ) : (
          <p className="text-center text-brand-navy/60">Nenhum recurso disponível</p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-brand-navy">Biblioteca Digital da Serie</h3>
        {libraryResources.length > 0 ? (
          <LoadMoreList
            items={libraryResources}
            initialLimit={4}
            step={4}
            renderItem={renderResourceCard}
          />
        ) : (
          <p className="text-center text-brand-navy/60">Sem itens na biblioteca da serie.</p>
        )}
      </div>
    </div>
  )
}

export default StudentResources
