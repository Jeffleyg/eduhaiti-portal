import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { sanitizeText, maskName } from "../lib/string.js"
import { apiFetch } from "../lib/api.js"
import LoadMoreList from "../components/LoadMoreList.jsx"

function FamilyPortal() {
  const { t } = useTranslation()
  const [enrollmentNumber, setEnrollmentNumber] = useState("")
  const [guardianName, setGuardianName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [overview, setOverview] = useState(null)

  const [contactForm, setContactForm] = useState({
    subject: "",
    body: "",
    guardianPhone: "",
    urgent: false,
  })

  const loadOverview = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const data = await apiFetch(
        `/family/overview/${encodeURIComponent(enrollmentNumber.trim())}?guardianName=${encodeURIComponent(guardianName.trim())}`,
      )
      setOverview(data)
      setMessage(t("familyOverviewLoaded"))
    } catch (err) {
      setOverview(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const sendContactRequest = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await apiFetch("/family/contact-request", {
        method: "POST",
        body: {
          enrollmentNumber: enrollmentNumber.trim(),
          guardianName: guardianName.trim(),
          guardianPhone: contactForm.guardianPhone || undefined,
          subject: contactForm.subject,
          body: contactForm.body,
          urgent: contactForm.urgent,
        },
      })
      setMessage(t("familyMessageSent"))
      setContactForm({ subject: "", body: "", guardianPhone: "", urgent: false })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-sand px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6 rounded-3xl border border-brand-navy/10 bg-white/80 p-6 shadow-xl shadow-brand-navy/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-brand-navy">{t("familyPortalTitle")}</h1>
            <p className="mt-1 text-sm text-brand-navy/70">{t("familyPortalSubtitle")}</p>
          </div>
          <Link to="/" className="outline-button">
            {t("back")}
          </Link>
        </div>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950">
          <h2 className="font-semibold">{t("securityTitle")}</h2>
          <p className="mt-1">{t("securityCopy")}</p>
        </section>

        {error ? <p className="text-sm text-brand-red">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
          <h2 className="text-base font-semibold text-brand-navy">{t("familyAccessTitle")}</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-3" onSubmit={loadOverview}>
            <input
              value={enrollmentNumber}
              onChange={(event) => setEnrollmentNumber(event.target.value)}
              placeholder={t("familyEnrollmentPlaceholder")}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
              autoComplete="off"
              required
            />
            <input
              value={guardianName}
              onChange={(event) => setGuardianName(event.target.value)}
              placeholder={t("guardianNamePlaceholderFamily")}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
              autoComplete="name"
              required
            />
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? t("loading") : t("consultFamilyData")}
            </button>
          </form>
        </section>

        {overview ? (
          <>
            <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
              <h3 className="font-semibold text-brand-navy">{t("studentProfileTitle")}</h3>
              <p className="text-sm text-brand-navy">{maskName(overview.student?.name, "student")}</p>
              <p className="text-xs text-brand-navy/70">{t("enrollmentLabel")}: {overview.student?.enrollmentNumber}</p>
              <p className="text-xs text-brand-navy/70">
                {t("classesLabel")}: {(overview.student?.classes ?? []).map((item) => sanitizeText(item.name)).join(", ") || "-"}
              </p>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-brand-navy/10 bg-white p-4">
                <h3 className="font-semibold text-brand-navy">{t("academicPerformanceTitle")}</h3>
                <div className="mt-3 space-y-2">
                  {(overview.grades ?? []).length ? (
                    overview.grades.map((item) => (
                      <div key={item.id} className="rounded-xl border border-brand-navy/10 p-3 text-sm">
                        <p className="font-semibold text-brand-navy">{sanitizeText(item.discipline?.name)} - {sanitizeText(item.class?.name)}</p>
                        <p className="text-brand-navy/70">{t("gradeLabel")}: {item.score}/{item.maxScore}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-brand-navy/60">{t("noGradesPublished")}</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-brand-navy/10 bg-white p-4">
                <h3 className="font-semibold text-brand-navy">{t("attendanceTitle")}</h3>
                <div className="mt-3 space-y-2">
                  {(() => {
                    const atts = overview.attendance ?? []
                    if (!atts.length) return <p className="text-sm text-brand-navy/60">{t("noAttendanceData")}</p>

                    const presentCount = atts.filter((a) => String(a.status).toLowerCase() === "present" || String(a.status).toLowerCase() === "presente").length
                    const absentCount = atts.filter((a) => String(a.status).toLowerCase() === "absent" || String(a.status).toLowerCase() === "ausente").length
                    const lastRecord = atts.slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0]

                    return (
                      <>
                        <div className="flex gap-3">
                          <div className="rounded-xl border border-brand-navy/10 bg-sand p-3 text-sm">
                            <p className="font-semibold text-brand-navy">{t("presentLabel")}</p>
                            <p className="text-brand-navy/70">{presentCount}</p>
                          </div>
                          <div className="rounded-xl border border-brand-navy/10 bg-sand p-3 text-sm">
                            <p className="font-semibold text-brand-navy">{t("absentLabel")}</p>
                            <p className="text-brand-navy/70">{absentCount}</p>
                          </div>
                          <div className="rounded-xl border border-brand-navy/10 bg-sand p-3 text-sm">
                            <p className="font-semibold text-brand-navy">{t("lastRecordLabel")}</p>
                            <p className="text-brand-navy/70">{lastRecord ? new Date(lastRecord.date).toLocaleString("pt-BR") : "-"}</p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <LoadMoreList
                            items={atts}
                            initialLimit={4}
                            step={4}
                            renderItem={(item) => (
                              <div className="rounded-xl border border-brand-navy/10 p-3 text-sm">
                                <p className="font-semibold text-brand-navy">
                                  {new Date(item.date).toLocaleDateString("pt-BR")} - {sanitizeText(item.class?.name)}
                                </p>
                                <p className="text-brand-navy/70">{t("status")}: {item.status}</p>
                                {item.remarks ? <p className="text-brand-navy/60">{t("remarksLabel")}: {item.remarks}</p> : null}
                              </div>
                            )}
                          />
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-brand-navy/10 bg-white p-4">
                <h3 className="font-semibold text-brand-navy">{t("schoolAnnouncementsTitle")}</h3>
                <div className="mt-3 space-y-2">
                  {(overview.announcements ?? []).length ? (
                    <LoadMoreList
                      items={overview.announcements ?? []}
                      initialLimit={3}
                      step={3}
                      renderItem={(item) => (
                        <div className="rounded-xl border border-brand-navy/10 p-3 text-sm">
                          <p className="font-semibold text-brand-navy">{item.title}</p>
                          <p className="text-brand-navy/70">{item.content}</p>
                        </div>
                      )}
                    />
                  ) : (
                    <p className="text-sm text-brand-navy/60">{t("noAnnouncements")}</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-brand-navy/10 bg-white p-4">
                <h3 className="font-semibold text-brand-navy">{t("familyNoticesTitle")}</h3>
                <div className="mt-3 space-y-2">
                  {(overview.familyNotices ?? []).length ? (
                    <LoadMoreList
                      items={overview.familyNotices ?? []}
                      initialLimit={3}
                      step={3}
                      renderItem={(item) => (
                        <div className="rounded-xl border border-brand-navy/10 p-3 text-sm">
                          <p className="font-semibold text-brand-navy">{String(item.title ?? "Recado")}</p>
                          <p className="text-brand-navy/70">{String(item.body ?? "")}</p>
                          <p className="text-xs text-brand-navy/60">{new Date(item.createdAt).toLocaleString("pt-BR")}</p>
                        </div>
                      )}
                    />
                  ) : (
                    <p className="text-sm text-brand-navy/60">{t("noSpecialNotices")}</p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
              <h3 className="font-semibold text-brand-navy">{t("directContactTitle")}</h3>
              <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={sendContactRequest}>
                <input
                  value={contactForm.subject}
                  onChange={(event) => setContactForm((prev) => ({ ...prev, subject: event.target.value }))}
                  placeholder={t("subjectPlaceholder")}
                  className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-2"
                  required
                />
                <textarea
                  value={contactForm.body}
                  onChange={(event) => setContactForm((prev) => ({ ...prev, body: event.target.value }))}
                  placeholder={t("messagePlaceholder")}
                  rows={4}
                  className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-2"
                  required
                />
                <input
                  value={contactForm.guardianPhone}
                  onChange={(event) => setContactForm((prev) => ({ ...prev, guardianPhone: event.target.value }))}
                  placeholder={t("guardianPhonePlaceholderFamily")}
                  className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                  autoComplete="tel"
                />
                <label className="flex items-center gap-2 text-sm text-brand-navy">
                  <input
                    type="checkbox"
                    checked={contactForm.urgent}
                    onChange={(event) => setContactForm((prev) => ({ ...prev, urgent: event.target.checked }))}
                  />
                  {t("urgentLabel")}
                </label>
                <button className="primary-button md:col-span-2" type="submit" disabled={loading}>
                  {loading ? t("sendingMessage") : t("sendToSecretary")}
                </button>
              </form>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default FamilyPortal