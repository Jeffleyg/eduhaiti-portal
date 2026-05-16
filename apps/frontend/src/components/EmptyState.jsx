import React from "react"
import { InboxIcon, FileText } from "lucide-react"

/**
 * EmptyState component for when no data is available
 * Shows icon, title, description, and optional action button
 */
export default function EmptyState({
  icon: Icon = InboxIcon,
  title = "Nenhum dado",
  description = "Não há dados para exibir no momento.",
  action,
  actionLabel = "Criar",
  className = "",
  ...props
}) {
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
