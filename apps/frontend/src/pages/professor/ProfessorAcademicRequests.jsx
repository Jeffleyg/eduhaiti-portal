import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"

const reviewStatuses = ["IN_REVIEW", "APPROVED", "REJECTED"]
const filterStatuses = ["", "PENDING", "IN_REVIEW", "APPROVED", "REJECTED"]

function ProfessorAcademicRequests() {
  const { t } = useTranslation()
  const { token, user } = useAuth()
  const [classes, setClasses] = useState([])
  const [requests, setRequests] = useState([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("")
  const [reviewForms, setReviewForms] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const classOptions = useMemo(
    () => classes.map((item) => ({ value: item.id, label: `${item.name} (${item.level})` })),
    [classes],
  )

  const loadClasses = async () => {
    try {
      const path = user?.role === "ADMIN" ? "/admin/classes" : "/classes/my-classes"
      const data = await apiFetch(path, { token })
      setClasses(data ?? [])
    } catch (err) {
      setError(err.message)
    }
  }

  const loadRequests = async () => {
    setLoading(true)
    setError("")
    setMessage("")
    try {
      const params = new URLSearchParams()
      if (selectedClassId) {
        params.set("classId", selectedClassId)
      }
      if (selectedStatus) {
        params.set("status", selectedStatus)
      }

      const path = params.toString() ? `/academic-requests?${params.toString()}` : "/academic-requests"
      const data = await apiFetch(path, { token })
      setRequests(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      loadClasses()
      loadRequests()
    }
  }, [token, user?.role])

  const handleReviewField = (requestId, field, value) => {
    setReviewForms((prev) => ({
      ...prev,
      [requestId]: {
        status: prev[requestId]?.status || "IN_REVIEW",
        resolutionComment: prev[requestId]?.resolutionComment || "",
        [field]: value,
      },
    }))
  }

  const submitReview = async (requestId) => {
    const form = reviewForms[requestId] || { status: "IN_REVIEW", resolutionComment: "" }

    setLoading(true)
    setError("")
    setMessage("")
    try {
      await apiFetch(`/academic-requests/${requestId}/review`, {
        method: "PATCH",
        token,
        body: {
          status: form.status,
          resolutionComment: form.resolutionComment || undefined,
        },
      })
      setMessage(t("academicReviewSaved"))
      await loadRequests()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title={t("academicReviewTitle")} subtitle={t("academicReviewSubtitle")} />

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={selectedClassId}
            onChange={(event) => setSelectedClassId(event.target.value)}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          >
            <option value="">{t("academicReviewFilterClass")}</option>
            {classOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          >
            {filterStatuses.map((status) => (
              <option key={status || "all"} value={status}>
                {status ? t(`academicRequestStatus_${status}`) : t("academicReviewFilterStatus")}
              </option>
            ))}
          </select>

          <button className="primary-button" type="button" onClick={loadRequests} disabled={loading}>
            {t("academicReviewLoad")}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <h3 className="text-base font-semibold text-brand-navy">{t("academicReviewList")}</h3>

        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-brand-navy/60">{t("loading")}</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-brand-navy/60">{t("noData")}</p>
          ) : (
            requests.map((item) => {
              const form = reviewForms[item.id] || { status: "IN_REVIEW", resolutionComment: "" }

              return (
                <article key={item.id} className="rounded-2xl border border-brand-navy/10 bg-white p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-brand-navy">{item.title}</p>
                      <p className="text-xs text-brand-navy/60">
                        {item.student?.name || item.student?.email} | {item.class?.name || "-"}
                      </p>
                      <p className="text-xs text-brand-navy/60">{t(`academicRequestType_${item.type}`)}</p>
                    </div>
                    <span className="rounded-full bg-brand-navy/10 px-2 py-1 text-xs font-semibold text-brand-navy">
                      {t(`academicRequestStatus_${item.status}`)}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-brand-navy/80">{item.details}</p>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <select
                      value={form.status}
                      onChange={(event) => handleReviewField(item.id, "status", event.target.value)}
                      className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                    >
                      {reviewStatuses.map((status) => (
                        <option key={status} value={status}>
                          {t(`academicRequestStatus_${status}`)}
                        </option>
                      ))}
                    </select>

                    <input
                      value={form.resolutionComment}
                      onChange={(event) =>
                        handleReviewField(item.id, "resolutionComment", event.target.value)
                      }
                      className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                      placeholder={t("academicRequestResolution")}
                    />
                  </div>

                  <button
                    className="primary-button mt-3"
                    type="button"
                    onClick={() => submitReview(item.id)}
                    disabled={loading}
                  >
                    {t("academicReviewAction")}
                  </button>
                </article>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}

export default ProfessorAcademicRequests
