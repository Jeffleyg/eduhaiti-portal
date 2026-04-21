import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"

function ProfessorMessages() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [messages, setMessages] = useState([])
  const [sentMessages, setSentMessages] = useState([])
  const [recipients, setRecipients] = useState([])
  const [toId, setToId] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [tab, setTab] = useState("inbox")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const [inbox, sent, recipientsList] = await Promise.all([
          apiFetch("/messages/inbox", { token }),
          apiFetch("/messages/sent", { token }),
          apiFetch("/messages/recipients", { token }),
        ])
        setMessages(inbox ?? [])
        setSentMessages(sent ?? [])
        setRecipients(recipientsList ?? [])
      } catch (error) {
        console.error("Failed to fetch messages:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
  }, [token])

  const handleSend = async (event) => {
    event.preventDefault()
    setError("")
    setFeedback("")

    if (!toId || !subject.trim() || !body.trim()) {
      setError(t("messageRequiredFields"))
      return
    }

    setSubmitting(true)
    try {
      await apiFetch("/messages", {
        method: "POST",
        token,
        body: {
          toId,
          subject: subject.trim(),
          body: body.trim(),
        },
      })

      const sent = await apiFetch("/messages/sent", { token })
      setSentMessages(sent ?? [])
      setSubject("")
      setBody("")
      setFeedback(t("messageSent"))
      setTab("sent")
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center text-brand-navy">{t("loading")}</div>
  }

  return (
    <div>
      <SectionHeader title={t("navMessages")} subtitle={t("messagesSubtitle")} />
      <div className="mb-6 rounded-3xl bg-white px-5 py-5">
        <h3 className="text-base font-semibold text-brand-navy">{t("composeMessage")}</h3>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        {feedback ? <p className="mt-2 text-sm text-emerald-600">{feedback}</p> : null}
        <form onSubmit={handleSend} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-brand-navy/80 md:col-span-2">
            {t("messageTo")}
            <select
              value={toId}
              onChange={(event) => setToId(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-brand-navy/15 px-3 py-2"
            >
              <option value="">{t("selectRecipient")}</option>
              {recipients.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {(recipient.name ?? recipient.email) + " (" + t("role" + recipient.role.toLowerCase()) + ")"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-brand-navy/80 md:col-span-2">
            {t("messageSubject")}
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-brand-navy/15 px-3 py-2"
              placeholder={t("messageSubject")}
            />
          </label>
          <label className="text-sm text-brand-navy/80 md:col-span-2">
            {t("messageBody")}
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              className="mt-1 w-full rounded-2xl border border-brand-navy/15 px-3 py-2"
              placeholder={t("messageBody")}
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-2xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? t("loading") : t("sendMessage")}
          </button>
        </form>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("inbox")}
          className={`rounded-2xl px-3 py-2 text-sm ${tab === "inbox" ? "bg-brand-navy text-white" : "bg-white text-brand-navy"}`}
        >
          {t("inbox")}
        </button>
        <button
          type="button"
          onClick={() => setTab("sent")}
          className={`rounded-2xl px-3 py-2 text-sm ${tab === "sent" ? "bg-brand-navy text-white" : "bg-white text-brand-navy"}`}
        >
          {t("sentMessages")}
        </button>
      </div>

      <div className="space-y-3">
        {(tab === "inbox" ? messages : sentMessages).length > 0 ? (
          (tab === "inbox" ? messages : sentMessages).map((message) => (
            <div key={message.id} className="rounded-2xl border border-brand-navy/10 bg-white px-4 py-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-brand-navy">
                  {tab === "inbox"
                    ? message.from?.name ?? message.from?.email
                    : message.to?.name ?? message.to?.email}
                </p>
              </div>
              <p className="mt-2 text-sm text-brand-navy/70">{message.subject}</p>
              <p className="mt-1 text-xs text-brand-navy/50">{message.body}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-brand-navy/60">{t("noData")}</p>
        )}
      </div>
    </div>
  )
}

export default ProfessorMessages
