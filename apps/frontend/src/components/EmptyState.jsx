import { useTranslation } from "react-i18next"
import React from "react"
import { InboxIcon, FileText } from "lucide-react"

/**
 * EmptyState component for when no data is available
 * Shows icon, title, description, and optional action button
 */
export default function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  actionLabel,
  className = "",
  ...props
}) {
  const { t } = useTranslation()
  // Defaults are translated; pass description={null} to hide it.
  title = title ?? t("noData")
  description = description === undefined ? t("emptyStateDescription") : description
  actionLabel = actionLabel ?? t("adminCreate")
  return (
    <div
      className={`flex flex-col items-center justify-center py-3xl px-lg text-center ${className}`}
      role="status"
      aria-label={title}
      {...props}
    >
      <div className="mb-lg text-gray-400">
        <Icon size={64} className="mx-auto opacity-50" aria-hidden="true" />
      </div>
      
      <h3 className="text-title text-gray-700 mb-md">{title}</h3>
      
      {description && (
        <p className="text-body text-gray-500 max-w-sm mb-xl">{description}</p>
      )}
      
      {action && (
        <button
          onClick={action}
          className="btn btn-primary"
          type="button"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
