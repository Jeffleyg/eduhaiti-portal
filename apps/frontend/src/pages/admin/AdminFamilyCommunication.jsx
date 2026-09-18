import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import SectionHeader from "../../components/SectionHeader.jsx"
import { sanitizeText, maskName } from "../../lib/string.js"
import AdminSectionToolbar from "../../components/AdminSectionToolbar.jsx"
import LoadMoreList from "../../components/LoadMoreList.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"

function AdminFamilyCommunication() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const [form, setForm] = useState({
    enrollmentNumber: "",
    title: "",
    body: "",
    severity: "normal",
    channel: "IN_APP",
    guardianPhone: "",
  })
  const [loading, setLoading] = useState(false)
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [respondingRequestId, setRespondingRequestId] = useState("")
  const [requests, setRequests] = useState([])
  const [responseDrafts, setResponseDrafts] = useState({})
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [activeSection, setActiveSection] = useState("compose")

  const loadRequests = async () => {
    setLoadingRequests(true)
    setError("")

    try {
      const data = await apiFetch("/family/admin/contact-requests", { token })
      setRequests(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingRequests(false)
    }
  }

  useEffect(() => {
    if (token) {
      loadRequests()
    }
  }, [token])

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await apiFetch("/family/admin/notices", {
        method: "POST",
        token,
        body: {
          enrollmentNumber: form.enrollmentNumber,
          title: form.title,
          body: form.body,
          severity: form.severity,
          channel: form.channel,
          guardianPhone: form.guardianPhone || undefined,
        },
      })
      setMessage("Comunicado enviado para a familia com sucesso.")
      setForm((prev) => ({ ...prev, title: "", body: "", guardianPhone: "" }))
      await loadRequests()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRespond = async (requestId) => {
    const responseMessage = responseDrafts[requestId]?.trim()

    if (!responseMessage) {
      setError("Escreva uma resposta antes de enviar.")
      return
    }

    setRespondingRequestId(requestId)
    setError("")
    setMessage("")

    try {
      await apiFetch(`/family/admin/contact-requests/${requestId}/respond`, {
        method: "POST",
        token,
        body: {
          responseMessage,
          notifyFamily: true,
        },
      })

      setMessage("Resposta enviada para a familia.")
      setResponseDrafts((prev) => ({ ...prev, [requestId]: "" }))
      await loadRequests()
    } catch (err) {
      setError(err.message)
    } finally {
      setRespondingRequestId("")
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("familyCommunicationTitle")}
        subtitle={t("familyCommunicationSubtitle")}
      />

      <div className="flex items-center justify-between">
        <AdminSectionToolbar
          sections={[{ key: "compose", label: t("composeMessage") }, { key: "requests", label: t("familyRequests") }]}
          active={activeSection}
          onChange={(k) => setActiveSection(k)}
        />
      </div>

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      {activeSection === "compose" && (
        <form onSubmit={submit} className="rounded-2xl border border-brand-navy/10 bg-white p-6 grid gap-3 md:grid-cols-2">
        <input
          value={form.enrollmentNumber}
          onChange={(event) => setForm((prev) => ({ ...prev, enrollmentNumber: event.target.value }))}
          placeholder={t("studentEnrollmentPlaceholder")}
          className="rounded-xl border border-brand-navy/20 px-3 py-2"
          required
        />

        <select
          value={form.severity}
          onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value }))}
          className="rounded-xl border border-brand-navy/20 px-3 py-2"
        >
          <option value="normal">{t("normal")}</option>
          <option value="urgent">{t("urgent")}</option>
        </select>

        <select
          value={form.channel}
          onChange={(event) => setForm((prev) => ({ ...prev, channel: event.target.value }))}
          className="rounded-xl border border-brand-navy/20 px-3 py-2"
        >
          <option value="IN_APP">{t("inAppMessage")}</option>
          <option value="SMS">{t("smsQueue")}</option>
          <option value="BOTH">{t("inAppPlusSmsQueue")}</option>
        </select>

        <input
          value={form.guardianPhone}
          onChange={(event) => setForm((prev) => ({ ...prev, guardianPhone: event.target.value }))}
          placeholder={t("guardianPhonePlaceholder")}
          className="rounded-xl border border-brand-navy/20 px-3 py-2"
        />

        <input
          value={form.title}
          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          placeholder={t("noticeTitlePlaceholder")}
          className="rounded-xl border border-brand-navy/20 px-3 py-2 md:col-span-2"
          required
        />

        <textarea
          value={form.body}
          onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
          placeholder={t("noticeBodyPlaceholder")}
          rows={5}
          className="rounded-xl border border-brand-navy/20 px-3 py-2 md:col-span-2"
          required
        />

        <button type="submit" className="primary-button md:col-span-2" disabled={loading}>
          {loading ? t("sending") : t("sendNotice")}
        </button>
        </form>
      )}

      {activeSection === "requests" && (
        <section className="rounded-2xl border border-brand-navy/10 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-brand-navy">{t("familyRequestsTitle")}</h3>
          <button type="button" className="outline-button" onClick={loadRequests} disabled={loadingRequests}>
            {loadingRequests ? t("updating") : t("refresh")}
          </button>
        </div>

        {loadingRequests ? (
          <p className="text-sm text-brand-navy/60">{t("loadingRequests")}</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-brand-navy/60">{t("noFamilyRequests")}</p>
        ) : (
          <LoadMoreList
            items={requests}
            initialLimit={4}
            step={4}
            renderItem={(request) => (
              <article key={request.requestId} className="rounded-xl border border-brand-navy/10 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-brand-navy">{request.subject || t("noSubject")}</p>
                    <p className="text-xs text-brand-navy/70">
                      {t("studentLabel")} {maskName(request.student?.name, "student")} ({request.enrollmentNumber || "-"})
                    </p>
                    <p className="text-xs text-brand-navy/70">
                      {t("guardianLabel")} {maskName(request.guardianName, "guardian")}
                      {request.guardianPhone ? ` | ${t("phoneLabel")} ${request.guardianPhone}` : ""}
                    </p>
                    <p className="text-xs text-brand-navy/60">
                      {t("receivedAt")} {new Date(request.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      request.status === "RESPONDED"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {request.status === "RESPONDED" ? t("responded") : t("pending")}
                  </span>
                </div>

                <p className="text-sm text-brand-navy/80 whitespace-pre-wrap">{sanitizeText(request.body)}</p>

                {request.response ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold text-emerald-800">{t("responseSent")}</p>
                    <p className="mt-1 text-sm text-emerald-900 whitespace-pre-wrap">
                      {sanitizeText(request.response.responseMessage)}
                    </p>
                    <p className="mt-1 text-xs text-emerald-700">
                      {new Date(request.response.respondedAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={responseDrafts[request.requestId] ?? ""}
                      onChange={(event) =>
                        setResponseDrafts((prev) => ({
                          ...prev,
                          [request.requestId]: event.target.value,
                        }))
                      }
                      placeholder={t("familyResponsePlaceholder")}
                      rows={3}
                      className="w-full rounded-xl border border-brand-navy/20 px-3 py-2"
                    />
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => handleRespond(request.requestId)}
                      disabled={respondingRequestId === request.requestId}
                    >
                      {respondingRequestId === request.requestId ? t("sendingResponse") : t("respondFamily")}
                    </button>
                  </div>
                )}
              </article>
            )}
          />
        )}
        </section>
      )}
    </div>
  )
}

export default AdminFamilyCommunication
