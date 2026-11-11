import { useTranslation } from "react-i18next"
import React from "react"

/**
 * Inline feedback. Two usages are supported:
 *  - <Feedback error={...} message={...} />          (error and success side by side)
 *  - <Feedback type="error|success" message={...} onClose={...} />
 */
export default function Feedback({ error, message, type, onClose }) {
  const { t } = useTranslation()
  const errorText = error ?? (type === "error" ? message : null)
  const successText = type === "error" ? null : message

  if (!errorText && !successText) return null

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="space-y-1">
        {errorText ? <p className="text-sm text-brand-red">{errorText}</p> : null}
        {successText ? <p className="text-sm text-emerald-600">{successText}</p> : null}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={t("closeMessage")}
          className="text-sm text-brand-navy/50 hover:text-brand-navy"
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
