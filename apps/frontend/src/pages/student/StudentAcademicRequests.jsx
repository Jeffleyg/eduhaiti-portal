import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"

const initialRequest = {
  classId: "",
  type: "ENROLLMENT_LETTER",
  title: "",
  details: "",
}

const requestTypes = [
  "ENROLLMENT_LETTER",
  "GRADE_REVIEW",
  "ABSENCE_JUSTIFICATION",
  "PROGRAM_CHANGE",
  "OTHER",
]

function StudentAcademicRequests() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [classes, setClasses] = useState([])
  const [requests, setRequests] = useState([])
  const [form, setForm] = useState(initialRequest)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const classOptions = useMemo(
    () => classes.map((item) => ({ value: item.id, label: `${item.name} (${item.level})` })),
    [classes],
  )

  const loadData = async () => {
    setLoading(true)
    setError("")
    setMessage("")
    try {
      const [myClasses, myRequests] = await Promise.all([
        apiFetch("/classes/my-classes", { token }),
        apiFetch("/academic-requests/me", { token }),
      ])
      setClasses(myClasses ?? [])
      setRequests(myRequests ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      loadData()
    }
  }, [token])

  const submitRequest = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")
    try {
      await apiFetch("/academic-requests", {
        method: "POST",
        token,
        body: {
          classId: form.classId || undefined,
          type: form.type,
          title: form.title,
          details: form.details,
        },
      })
      setForm(initialRequest)
      setMessage(t("academicRequestCreated"))
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title={t("academicRequestTitle")} subtitle={t("academicRequestSubtitleStudent")} />

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h3 className="text-base font-semibold text-brand-navy">{t("academicRequestCreate")}</h3>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={submitRequest}>
          <select
            value={form.classId}
            onChange={(event) => setForm((prev) => ({ ...prev, classId: event.target.value }))}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          >
            <option value="">{t("academicRequestClassOptional")}</option>
            {classOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={form.type}
            onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          >
            {requestTypes.map((type) => (
              <option key={type} value={type}>
                {t(`academicRequestType_${type}`)}
              </option>
            ))}
          </select>

          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-2"
            placeholder={t("academicRequestSubject")}
            required
          />

          <textarea
            value={form.details}
            onChange={(event) => setForm((prev) => ({ ...prev, details: event.target.value }))}
            className="min-h-[120px] rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-2"
            placeholder={t("academicRequestDetails")}
            required
          />

          <button className="primary-button md:col-span-2" type="submit" disabled={loading}>
            {t("academicRequestSubmit")}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h3 className="text-base font-semibold text-brand-navy">{t("academicRequestMyList")}</h3>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-brand-navy/60">{t("loading")}</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-brand-navy/60">{t("noData")}</p>
          ) : (
            requests.map((item) => (
              <article key={item.id} className="rounded-2xl border border-brand-navy/10 bg-white p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-brand-navy">{item.title}</p>
                    <p className="text-xs text-brand-navy/60">{t(`academicRequestType_${item.type}`)}</p>
                  </div>
                  <span className="rounded-full bg-brand-navy/10 px-2 py-1 text-xs font-semibold text-brand-navy">
                    {t(`academicRequestStatus_${item.status}`)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-brand-navy/80">{item.details}</p>
                <p className="mt-2 text-xs text-brand-navy/60">
                  {t("academicRequestReviewer")}: {item.reviewedBy?.name || item.reviewedBy?.email || "-"}
                </p>
                <p className="mt-1 text-xs text-brand-navy/60">
                  {t("academicRequestResolution")}: {item.resolutionComment || "-"}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default StudentAcademicRequests
