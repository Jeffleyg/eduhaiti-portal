import React from "react"

/**
 * Flexible Card component with multiple variants
 * Use for containers, list items, or dashboard content
 */
export default function Card({
  children,
  variant = "default",
  clickable = false,
  onClick,
  className = "",
  header,
  footer,
  padded = true,
  ...props
}) {
  const variants = {
    default: "card",
    elevated: "card-elevated",
    flat: "card-flat",
    hover: "card-hover",
    bordered: "bg-white rounded-lg border-2 border-gray-200 p-lg",
  }

  const baseClass = variants[variant] || variants.default
  const interactiveClass = clickable && "cursor-pointer hover:shadow-md transition-all"

  return (
    <div
      className={`${baseClass} ${interactiveClass} ${className}`}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                onClick?.()
              }
            }
          : undefined
      }
      {...props}
    >
      {header && <div className="mb-lg border-b border-gray-200 pb-lg">{header}</div>}
      
      <div className={padded ? "" : ""}>
        {children}
      </div>
      
      {footer && <div className="mt-lg border-t border-gray-200 pt-lg">{footer}</div>}
    </div>
  )
}
