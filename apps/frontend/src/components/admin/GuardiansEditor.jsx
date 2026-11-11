import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { apiFetch } from "../../lib/api.js"

const ROLES = [
  { relationship: "FATHER", nameKey: "fatherName", phoneKey: "fatherPhone" },
  { relationship: "MOTHER", nameKey: "motherName", phoneKey: "motherPhone" },
]

const emptyRows = () => ({
  FATHER: { fullName: "", phoneNumber: "" },
  MOTHER: { fullName: "", phoneNumber: "" },
})

/**
 * Edits the father/mother phones of one student. Their phones drive absence SMS,
 * the SMS/IVR gateway and the family portal login.
 */
export default function GuardiansEditor({ studentId, token, onClose }) {
  const { t } = useTranslation()
  const [rows, setRows] = useState(emptyRows)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    let active = true
    apiFetch(`/admin/users/students/${studentId}/guardians`, { token })
      .then((guardians) => {
        if (!active) return
        const next = emptyRows()
        for (const guardian of guardians ?? []) {
          if (next[guardian.relationship]) {
            next[guardian.relationship] = { fullName: guardian.fullName ?? "", phoneNumber: guardian.phoneNumber ?? "" }
          }
        }
        setRows(next)
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [studentId, token])

  const update = (relationship, field, value) =>
    setRows((prev) => ({ ...prev, [relationship]: { ...prev[relationship], [field]: value } }))

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const guardians = ROLES.filter(({ relationship }) => rows[relationship].phoneNumber.trim()).map(
        ({ relationship }) => ({
          relationship,
          fullName: rows[relationship].fullName.trim() || (relationship === "FATHER" ? t("father") : t("mother")),
          phoneNumber: rows[relationship].phoneNumber.trim(),
        }),
      )
      await apiFetch(`/admin/users/students/${studentId}/guardians`, { method: "PUT", token, body: { guardians } })
      setMessage(t("guardiansSaved"))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-3 rounded-2xl border border-brand-navy/10 bg-sand p-3" aria-label={t("guardiansTitle")}>
      <p className="text-sm font-semibold text-brand-navy">{t("guardiansTitle")}</p>
      {loading ? (
        <p className="text-xs text-brand-navy/60">{t("loading")}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES.map(({ relationship, nameKey, phoneKey }) => (
            <div key={relationship} className="space-y-2">
              <input
                aria-label={t(nameKey)}
                value={rows[relationship].fullName}
                onChange={(event) => update(relationship, "fullName", event.target.value)}
                placeholder={t(nameKey)}
                className="w-full rounded-xl border border-brand-navy/10 bg-white px-3 py-2 text-sm"
              />
              <input
                aria-label={t(phoneKey)}
                type="tel"
                value={rows[relationship].phoneNumber}
                onChange={(event) => update(relationship, "phoneNumber", event.target.value)}
                placeholder="+509 3700 0000"
                className="w-full rounded-xl border border-brand-navy/10 bg-white px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-brand-navy/60">{t("guardianPhoneHint")}</p>
      {error ? <p className="text-xs text-brand-red">{error}</p> : null}
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      <div className="flex gap-2">
        <button type="submit" className="primary-button" disabled={loading || saving}>
          {saving ? t("loading") : t("save")}
        </button>
        <button type="button" className="outline-button" onClick={onClose}>
          {t("adminCancel")}
        </button>
      </div>
    </form>
  )
}
