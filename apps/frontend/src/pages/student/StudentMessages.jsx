import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"

function StudentMessages() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const inbox = await apiFetch("/messages/inbox", { token })
        setMessages(inbox ?? [])
      } catch (error) {
        console.error("Failed to fetch messages:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
  }, [token])

  if (loading) {
    return <div className="text-center text-brand-navy">{t("loading")}</div>
  }

  return (
    <div>
      <SectionHeader title={t("navMessages")} subtitle={t("messagesSubtitle")} />
      <div className="space-y-3">
        {messages.length > 0 ? (
          messages.map((message) => (
            <div
              key={message.id}
              className="rounded-2xl border border-brand-navy/10 bg-white px-4 py-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-brand-navy">{message.from?.name ?? message.from?.email}</p>
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

export default StudentMessages
