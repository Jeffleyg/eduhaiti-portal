import { useState, useEffect } from "react"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react"

/**
 * Toast/Notification container - place once at root level
 */
export function ToastContainer() {
  return <div id="toast-container" className="fixed top-lg right-lg z-50 space-y-lg pointer-events-none" />
}

/**
 * Toast component - individual notification
 */
export function Toast({ type = "info", title, message, duration = 4000, onClose }) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onClose, 300)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  }

  const colors = {
    success: "bg-success text-white",
    error: "bg-danger text-white",
    warning: "bg-warning text-white",
    info: "bg-info text-white",
  }

  const Icon = icons[type] || icons.info

  return (
    <div
      className={`rounded-lg shadow-lg p-lg flex gap-lg items-start pointer-events-auto transition-all duration-300 ${
        colors[type]
      } ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-lg"}`}
    >
      <Icon size={20} className="flex-shrink-0 mt-sm" aria-hidden="true" />
      <div className="flex-1">
        {title && <div className="font-semibold">{title}</div>}
        {message && <div className="text-sm opacity-95">{message}</div>}
      </div>
      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(onClose, 300)
        }}
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
        aria-label="Close notification"
      >
        <X size={20} />
      </button>
    </div>
  )
}
