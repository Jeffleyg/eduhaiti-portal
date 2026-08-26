import { useEffect } from "react"

function Modal({ isOpen, onClose, title, children, size = "md", actions }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }

    return () => {
      document.body.style.overflow = "auto"
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizeClasses = {
    sm: "w-full max-w-sm",
    md: "w-full max-w-2xl",
    lg: "w-full max-w-4xl",
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className={`${sizeClasses[size]} rounded-2xl border border-brand-navy/10 bg-white shadow-2xl shadow-brand-navy/15`}>
        <div className="flex items-center justify-between border-b border-brand-navy/10 px-6 py-4">
          <h2 className="font-display text-xl font-semibold text-brand-navy">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full px-2 py-1 text-2xl leading-none text-brand-navy/50 transition-colors hover:bg-brand-navy/5 hover:text-brand-navy"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="max-h-[calc(100vh-300px)] overflow-y-auto px-6 py-4">
          {children}
        </div>

        {actions && (
          <div className="border-t border-brand-navy/10 flex gap-2 justify-end px-6 py-4">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal
