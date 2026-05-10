import React from "react"

export default function PaginationControls({
  currentPage,
  totalPages,
  previousLabel,
  continueLabel,
  onPrevious,
  onContinue,
}) {
  if (totalPages <= 1) return null

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm shadow-sm">
      <button
        className="outline-button"
        onClick={onPrevious}
        type="button"
        disabled={currentPage <= 1}
      >
        {previousLabel}
      </button>
      <p className="text-xs font-medium text-brand-navy/70">
        Página {currentPage} de {totalPages}
      </p>
      <button
        className="outline-button"
        onClick={onContinue}
        type="button"
        disabled={currentPage >= totalPages}
      >
        {continueLabel}
      </button>
    </div>
  )
}
