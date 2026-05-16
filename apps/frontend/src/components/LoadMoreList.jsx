import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import PaginationControls from "./PaginationControls.jsx"

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
  const nextLabel = continueLabel ?? t("continue") ?? "Next"
  const prevLabel = previousLabel ?? t("previous") ?? "Previous"
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

      <PaginationControls
        currentPage={safePage}
        totalPages={totalPages}
        previousLabel={prevLabel}
        continueLabel={nextLabel}
        onPrevious={() => setPage((prev) => Math.max(1, prev - 1))}
        onContinue={() => setPage((prev) => Math.min(totalPages, prev + 1))}
      />
    </div>
  )
}

export default LoadMoreList
