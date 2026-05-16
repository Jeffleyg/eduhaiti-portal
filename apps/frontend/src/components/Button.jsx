import React from "react"
import { Loader2 } from "lucide-react"

/**
 * Enhanced Button component with multiple variants and sizes
 */
export default function Button({
  variant = "primary",
  size = "md",
  children,
  disabled = false,
  onClick,
  type = "button",
  icon: Icon,
  loading = false,
  fullWidth = false,
  className = "",
  ...props
}) {
  const sizes = {
    sm: "btn-sm",
    md: "btn",
    lg: "btn-lg",
  }

  const variants_map = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    outline: "btn-outline",
    ghost: "btn-ghost",
    danger: "btn bg-danger text-white hover:bg-opacity-90 shadow-sm hover:shadow-md",
    success: "btn bg-success text-white hover:bg-opacity-90 shadow-sm hover:shadow-md",
  }

  const widthClass = fullWidth ? "w-full" : ""
  const variantClass = variants_map[variant] || variants_map.primary
  const sizeClass = sizes[size] || sizes.md

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${variantClass} ${sizeClass} ${widthClass} ${className} ${
        disabled || loading ? "btn-disabled" : ""
      } flex items-center justify-center gap-md`}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
      {Icon && !loading && <Icon size={18} aria-hidden="true" />}
      {children}
    </button>
  )
}

