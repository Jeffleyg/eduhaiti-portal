import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { HelpCircle } from "lucide-react"

/**
 * Tooltip component for help text and additional information
 */
export function Tooltip({ children, content, position = "top", icon: Icon = HelpCircle }) {
  const [isVisible, setIsVisible] = useState(false)

  const positionClass = {
    top: "bottom-full mb-md",
    bottom: "top-full mt-md",
    left: "right-full mr-md",
    right: "left-full ml-md",
  }[position]

  return (
    <div className="relative inline-block group">
      <button
        type="button"
        className="text-gray-400 hover:text-gray-600 transition-colors inline-flex"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        aria-label="More information"
        aria-describedby="tooltip-content"
      >
        <Icon size={16} />
      </button>

      {isVisible && (
        <div
          id="tooltip-content"
          className={`absolute z-40 bg-ink text-white text-sm rounded-md px-md py-sm whitespace-nowrap ${positionClass} pointer-events-none animate-fade-in`}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  )
}

/**
 * Help text component for form field guidance
 */
export function HelpText({ children, icon: Icon = HelpCircle }) {
  return (
    <div className="flex items-start gap-sm text-gray-600 text-sm mt-md">
      {Icon && <Icon size={16} className="flex-shrink-0 mt-xs" aria-hidden="true" />}
      {children}
    </div>
  )
}

/**
 * Progress indicator
 */
export function Progress({ value = 0, max = 100, label, variant = "info", showPercentage = true }) {
  const percentage = (value / max) * 100

  const variants = {
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  }

  return (
    <div>
      {label && (
        <div className="flex justify-between items-center mb-md">
          <label className="text-sm font-semibold">{label}</label>
          {showPercentage && <span className="text-sm text-gray-600">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`${variants[variant]} h-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label}
        />
      </div>
    </div>
  )
}

/**
 * Divider component
 */
export function Divider({ label, className = "" }) {
  if (label) {
    return (
      <div className={`flex items-center gap-lg my-lg ${className}`}>
        <div className="flex-1 divider" />
        <span className="text-sm text-gray-500">{label}</span>
        <div className="flex-1 divider" />
      </div>
    )
  }

  return <div className={`divider my-lg ${className}`} />
}

/**
 * Spinner/Loading indicator
 */
export function Spinner({ size = "md", label }) {
  const { t } = useTranslation()
  const resolvedLabel = label ?? t("loading")
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  }

  return (
    <div className="flex flex-col items-center justify-center gap-md">
      <div
        className={`${sizes[size]} border-4 border-gray-200 border-t-brand-red rounded-full animate-spin`}
        role="status"
        aria-label={label}
      />
      {resolvedLabel && <span className="text-sm text-gray-600">{resolvedLabel}</span>}
    </div>
  )
}

/**
 * Skeleton loader - animated placeholder
 */
export function SkeletonBox({ width = "w-full", height = "h-4", className = "" }) {
  return (
    <div
      className={`${width} ${height} bg-gray-200 rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  )
}
