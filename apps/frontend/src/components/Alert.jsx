import React from "react"
import { AlertCircle, Info, CheckCircle, AlertTriangle } from "lucide-react"

/**
 * Alert/Notification component with multiple variants
 */
export default function Alert({
  children,
  variant = "info",
  title,
  onClose,
  closeable = true,
  className = "",
  ...props
}) {
  const variants = {
    success: {
      class: "alert-success",
      icon: CheckCircle,
    },
    warning: {
      class: "alert-warning",
      icon: AlertTriangle,
    },
    danger: {
      class: "alert-danger",
      icon: AlertCircle,
    },
    info: {
      class: "alert-info",
      icon: Info,
    },
  }

  const config = variants[variant] || variants.info
  const Icon = config.icon

  return (
    <div
      className={`${config.class} flex gap-lg items-start animate-slide-down ${className}`}
      role="alert"
      {...props}
    >
      <Icon size={20} className="flex-shrink-0 mt-sm" aria-hidden="true" />
      <div className="flex-1">
        {title && <div className="font-semibold mb-sm">{title}</div>}
        <div className="text-sm">{children}</div>
      </div>
      {closeable && onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 text-lg hover:opacity-70 transition-opacity"
          aria-label="Close alert"
          type="button"
        >
          ×
        </button>
      )}
    </div>
  )
}
