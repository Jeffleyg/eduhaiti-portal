import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

function LoadMoreList({
  items = [],
  renderItem,
  initialLimit = 5,
  step = 5,
  continueLabel,
  previousLabel,
}) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const pageSize = step || initialLimit || 5
  const nextLabel = continueLabel ?? t("continue") ?? "Próximo"
  const prevLabel = previousLabel ?? t("previous") ?? "Anterior"
  const totalPages = Math.max(1, Math.ceil((Array.isArray(items) ? items.length : 0) / pageSize))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  if (!Array.isArray(items) || items.length === 0) {
    return <div className="text-sm text-brand-navy/60">Nenhum item.</div>
  }

  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const visible = items.slice(start, start + pageSize)

  return (
    <div>
      <div className="space-y-3">
        {visible.map((it, idx) => (
          <div key={it.id ?? idx}>{renderItem(it)}</div>
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm">
          <button
            className="outline-button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            type="button"
            disabled={safePage <= 1}
          >
            {prevLabel}
          </button>
          <p className="text-xs text-brand-navy/70">
            Página {safePage} de {totalPages}
          </p>
          <button
            className="outline-button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            type="button"
            disabled={safePage >= totalPages}
          >
            {nextLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default LoadMoreList
