import React, { useState, useEffect } from "react"
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
export function Toast({ id, type = "info", title, message, duration = 4000, onClose }) {
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

/**
 * Toast service - call from anywhere
 */
export const toast = {
  show: (options) => {
    const container = document.getElementById("toast-container")
    if (!container) return

    const id = Date.now()
    const div = document.createElement("div")
    div.key = id

    const { onClose, ...props } = options

    const handleClose = () => {
      div.remove()
      onClose?.()
    }

    const root = ReactDOM.createRoot(div)
    root.render(
      <Toast {...props} id={id} onClose={handleClose} />
    )

    container.appendChild(div)
    return id
  },

  success: (message, title = "Sucesso") => {
    toast.show({ type: "success", title, message })
  },

  error: (message, title = "Erro") => {
    toast.show({ type: "error", title, message })
  },

  warning: (message, title = "Aviso") => {
    toast.show({ type: "warning", title, message })
  },

  info: (message, title = "Informação") => {
    toast.show({ type: "info", title, message })
  },
}

// Simple alternative: use with React state
export function useToast() {
  const [toasts, setToasts] = useState([])

  const showToast = (options) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, ...options }])
  }

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return { toasts, showToast, removeToast }
}
