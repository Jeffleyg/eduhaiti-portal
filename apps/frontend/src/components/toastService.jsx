import { useState } from "react"
import ReactDOM from "react-dom/client"
import { Toast } from "./Toast.jsx"

/**
 * Toast service - call from anywhere once <ToastContainer /> is mounted.
 * Kept apart from the components so React Fast Refresh keeps working.
 */
export const toast = {
  show: (options) => {
    const container = document.getElementById("toast-container")
    if (!container) return

    const id = Date.now()
    const div = document.createElement("div")
    const { onClose, ...props } = options
    const root = ReactDOM.createRoot(div)

    const handleClose = () => {
      // Unmount before removing the node, otherwise every toast leaks a React root.
      root.unmount()
      div.remove()
      onClose?.()
    }

    root.render(<Toast {...props} onClose={handleClose} />)
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

/** Simple alternative: keep toasts in React state. */
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
