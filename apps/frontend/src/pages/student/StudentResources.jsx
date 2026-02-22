import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"

function StudentResources() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [resources, setResources] = useState([])
  const [classes, setClasses ] = useState([])
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
      <SectionHeader title="Recursos de Aula" subtitle="PDFs, slides e documentos compartilhados pelos professores" />

      <div className="space-y-3">
        {resources.length > 0 ? (
          resources.map((resource) => (
            <div key={resource.id} className="rounded-2xl border border-brand-navy/10 bg-white p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-brand-navy">{resource.title}</p>
                <p className="text-sm text-brand-navy/60">{resource.description}</p>
                <p className="text-xs text-brand-navy/50 mt-1">Por: {resource.uploadedBy?.name}</p>
              </div>
              <a href={`/${resource.filePath}`} download className="text-brand-red font-semibold hover:underline whitespace-nowrap">
                Download
              </a>
            </div>
          ))
        ) : (
          <p className="text-center text-brand-navy/60">Nenhum recurso disponível</p>
        )}
      </div>
    </div>
  )
}

export default StudentResources
