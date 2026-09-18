import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { sanitizeText } from "../../lib/string.js"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"

function StudentLessonPlans() {
  const { token } = useAuth()
  const [classes, setClasses] = useState([])
  const [plansByClass, setPlansByClass] = useState({})
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()

  useEffect(() => {
    const load = async () => {
      try {
        const myClasses = await apiFetch("/classes/my-classes", { token })
        setClasses(myClasses ?? [])
        // fetch plans per class
        const map = {}
        for (const c of (myClasses ?? [])) {
          try {
            const remote = await apiFetch(`/lessons?classId=${encodeURIComponent(c.id)}`, { token })
            map[c.id] = remote ?? []
          } catch (err) {
            // fallback to local
            const key = `lessonplans:${c.id}`
            map[c.id] = JSON.parse(localStorage.getItem(key) || "[]")
          }
        }
        setPlansByClass(map)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  if (loading) return <div className="text-center text-brand-navy">{t("loading")}</div>

  return (
    <div className="space-y-6">
      <SectionHeader title={t("lessonPlansTitle") || "Lesson plans"} subtitle={t("lessonPlansSubtitle") || "Access lesson plans for your classes."} />

      <div className="space-y-3">
        {classes.length ? (
          classes.map((c) => (
            <div key={c.id} className="rounded-2xl border border-brand-navy/10 bg-white p-4">
              <p className="font-semibold text-brand-navy">{sanitizeText(c.name)}</p>
              <div className="mt-3 space-y-2">
                {(plansByClass[c.id] ?? []).length ? (
                  (plansByClass[c.id] ?? []).map((p) => (
                    <div key={p.id} className="rounded-xl border p-3">
                      <p className="font-semibold">{p.title} <span className="text-xs text-brand-navy/60">{p.date}</span></p>
                      {p.objectives ? <p className="text-sm">{p.objectives}</p> : null}
                      {p.methodology ? <p className="text-xs text-brand-navy/70">Metodologia: {p.methodology}</p> : null}
                      {p.content ? <p className="text-xs text-brand-navy/60">{p.content}</p> : null}
                      {Array.isArray(p.tags) && p.tags.length ? <p className="text-xs text-brand-navy/60">Tags: {p.tags.join(", ")}</p> : null}
                    </div>
                  ))
                  ) : (
                  <p className="text-sm text-brand-navy/60">{t("noLessonPlansForClass") || 'No plans published for this class.'}</p>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-brand-navy/60">{t("notAssignedToAnyClass") || 'You are not assigned to any class.'}</p>
        )}
      </div>
    </div>
  )
}

export default StudentLessonPlans
