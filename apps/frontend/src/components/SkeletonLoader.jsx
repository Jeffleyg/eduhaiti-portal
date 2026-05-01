import React from "react"
import "../styles/SkeletonLoader.css"

/**
 * Skeleton Loader para cartões de dados
 * Mantém o espaço reservado enquanto carrega
 */
function SkeletonLoader({ type = "card", count = 1, className = "" }) {
  if (type === "card") {
    return (
      <div className={`space-y-4 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-header">
              <div className="skeleton-avatar" />
              <div className="skeleton-text space-y-2">
                <div className="skeleton-line-sm" />
                <div className="skeleton-line-xs" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="skeleton-line" />
              <div className="skeleton-line-sm" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (type === "table") {
    return (
      <div className="space-y-3">
        {/* Table header */}
        <div className="skeleton-table-row">
          <div className="skeleton-line-sm" style={{ flex: 2 }} />
          <div className="skeleton-line-sm" style={{ flex: 1 }} />
          <div className="skeleton-line-sm" style={{ flex: 1 }} />
          <div className="skeleton-line-sm" style={{ flex: 1 }} />
        </div>
        {/* Table rows */}
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton-table-row">
            <div className="skeleton-line-sm" style={{ flex: 2 }} />
            <div className="skeleton-line-sm" style={{ flex: 1 }} />
            <div className="skeleton-line-sm" style={{ flex: 1 }} />
            <div className="skeleton-line-sm" style={{ flex: 1 }} />
          </div>
        ))}
      </div>
    )
  }

  if (type === "section") {
    return (
      <div className="skeleton-section">
        <div className="skeleton-line-lg mb-4" />
        <div className="space-y-3">
          <div className="skeleton-line" />
          <div className="skeleton-line-sm" />
          <div className="skeleton-line" />
        </div>
      </div>
    )
  }

  if (type === "dashboard") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="skeleton-section">
          <div className="skeleton-line-lg mb-2" />
          <div className="skeleton-line-sm" style={{ width: "60%" }} />
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card-compact">
              <div className="skeleton-avatar mb-3" />
              <div className="skeleton-line-sm" />
              <div className="skeleton-line-xs mt-2" style={{ width: "70%" }} />
            </div>
          ))}
        </div>

        {/* Content section */}
        <div className="skeleton-card">
          <div className="skeleton-line-lg mb-4" />
          <div className="space-y-3">
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line-sm" />
          </div>
        </div>
      </div>
    )
  }

  if (type === "list") {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton-list-item">
            <div className="skeleton-circle" />
            <div className="skeleton-line" style={{ flex: 1 }} />
            <div className="skeleton-line-sm" style={{ width: "100px" }} />
          </div>
        ))}
      </div>
    )
  }

  // Default: simple line
  return <div className="skeleton-line" />
}

export default SkeletonLoader
