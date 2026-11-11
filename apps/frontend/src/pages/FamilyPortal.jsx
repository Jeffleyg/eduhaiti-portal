import { uiLocale } from "../lib/locale.js"
import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { sanitizeText, maskName } from "../lib/string.js"
import { apiFetch } from "../lib/api.js"
import LoadMoreList from "../components/LoadMoreList.jsx"

function FamilyPortal() {
  const { t } = useTranslation()
  const [enrollmentNumber, setEnrollmentNumber] = useState("")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  // "identify" -> "code" -> signed in (session token kept in memory only).
  const [step, setStep] = useState("identify")
  const [sessionToken, setSessionToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [overview, setOverview] = useState(null)

  const [contactForm, setContactForm] = useState({
    subject: "",
    body: "",
    urgent: false,
  })

  const run = async (action) => {
    setLoading(true)
    setError("")
    setMessage("")
    try {
      await action()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const requestCode = (event) => {
    event.preventDefault()
    return run(async () => {
      await apiFetch("/family/access/request-code", {
        method: "POST",
        body: { enrollmentNumber: enrollmentNumber.trim(), phone: phone.trim() },
      })
      setStep("code")
      setMessage(t("familyCodeSent"))
    })
  }

  const verifyCode = (event) => {
    event.preventDefault()
    return run(async () => {
      const session = await apiFetch("/family/access/verify", {
        method: "POST",
        body: { enrollmentNumber: enrollmentNumber.trim(), phone: phone.trim(), code: code.trim() },
      })
      const data = await apiFetch("/family/overview", { token: session.token })
      setSessionToken(session.token)
      setOverview(data)
      setCode("")
      setStep("signedIn")
      setMessage(t("familyOverviewLoaded"))
    })
  }

  const signOut = () => {
    setSessionToken("")
    setOverview(null)
    setStep("identify")
    setMessage("")
    setError("")
  }

  const sendContactRequest = (event) => {
    event.preventDefault()
    return run(async () => {
      await apiFetch("/family/contact-request", {
        method: "POST",
        token: sessionToken,
        body: {
          subject: contactForm.subject,
          body: contactForm.body,
          urgent: contactForm.urgent,
        },
      })
      setMessage(t("familyMessageSent"))
      setContactForm({ subject: "", body: "", urgent: false })
    })
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

        {step !== "signedIn" ? (
          <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
            <h2 className="text-base font-semibold text-brand-navy">{t("familyAccessTitle")}</h2>
            {step === "identify" ? (
              <form className="mt-3 grid gap-3 md:grid-cols-3" onSubmit={requestCode}>
                <input
                  value={enrollmentNumber}
                  onChange={(event) => setEnrollmentNumber(event.target.value)}
                  placeholder={t("familyEnrollmentPlaceholder")}
                  className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                  autoComplete="off"
                  required
                />
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder={t("familyPhonePlaceholder")}
                  className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                />
                <button className="primary-button" type="submit" disabled={loading}>
                  {loading ? t("loading") : t("familySendCode")}
                </button>
              </form>
            ) : (
              <form className="mt-3 grid gap-3 md:grid-cols-3" onSubmit={verifyCode}>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={t("familyCodePlaceholder")}
                  className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-center font-mono text-lg tracking-widest"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  required
                />
                <button className="primary-button" type="submit" disabled={loading || code.length !== 6}>
                  {loading ? t("loading") : t("consultFamilyData")}
                </button>
                <button className="outline-button" type="button" onClick={() => setStep("identify")}>
                  {t("familyChangeNumber")}
                </button>
              </form>
            )}
          </section>
        ) : (
          <div className="flex justify-end">
            <button className="outline-button" type="button" onClick={signOut}>
              {t("familySignOut")}
            </button>
          </div>
        )}

        {overview ? (
          <>
            <section className="module-card compact p-3">
              <h3 className="font-semibold text-brand-navy">{t("studentProfileTitle")}</h3>
              <p className="text-sm font-semibold text-brand-navy">{maskName(overview.student?.name, "student")}</p>
              <p className="text-xs text-brand-navy/75">{t("enrollmentLabel")}: {overview.student?.enrollmentNumber}</p>
              <p className="text-xs text-brand-navy/75">{t("classesLabel")}: {(overview.student?.classes ?? []).map((item) => sanitizeText(item.name)).join(", ") || "-"}</p>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-brand-navy/10 bg-white p-4">
                <h3 className="font-semibold text-brand-navy">{t("academicPerformanceTitle")}</h3>
                  <div className="mt-2 space-y-2">
                    {(overview.grades ?? []).length ? (
                      overview.grades.map((item) => (
                        <div key={item.id} className="module-card compact p-2">
                          <p className="font-semibold text-sm text-brand-navy">{sanitizeText(item.discipline?.name)} - {sanitizeText(item.class?.name)}</p>
                          <p className="text-xs text-brand-navy/75">{t("gradeLabel")}: {item.score}/{item.maxScore}</p>
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
                        <div className="flex gap-2">
                          <div className="module-card compact p-2 bg-sand text-sm">
                            <p className="font-semibold text-brand-navy">{t("presentLabel")}</p>
                            <p className="text-brand-navy/75">{presentCount}</p>
                          </div>
                          <div className="module-card compact p-2 bg-sand text-sm">
                            <p className="font-semibold text-brand-navy">{t("absentLabel")}</p>
                            <p className="text-brand-navy/75">{absentCount}</p>
                          </div>
                          <div className="module-card compact p-2 bg-sand text-sm">
                            <p className="font-semibold text-brand-navy">{t("lastRecordLabel")}</p>
                            <p className="text-brand-navy/75">{lastRecord ? new Date(lastRecord.date).toLocaleString(uiLocale()) : "-"}</p>
                          </div>
                        </div>

                        <div className="mt-2">
                          <LoadMoreList
                            items={atts}
                            initialLimit={4}
                            step={4}
                            renderItem={(item) => (
                              <div className="module-card compact p-2 text-sm">
                                <p className="font-semibold text-brand-navy text-sm">
                                  {new Date(item.date).toLocaleDateString(uiLocale())} - {sanitizeText(item.class?.name)}
                                </p>
                                <p className="text-brand-navy/75">{t("status")}: {item.status}</p>
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
                        <div className="module-card compact p-2 text-sm">
                          <p className="font-semibold text-brand-navy">{item.title}</p>
                          <p className="text-brand-navy/75">{item.content}</p>
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
                        <div className="module-card compact p-2 text-sm">
                          <p className="font-semibold text-brand-navy">{String(item.title ?? "Recado")}</p>
                          <p className="text-brand-navy/75">{String(item.body ?? "")}</p>
                          <p className="text-xs text-brand-navy/60">{new Date(item.createdAt).toLocaleString(uiLocale())}</p>
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