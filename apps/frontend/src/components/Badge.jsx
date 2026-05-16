import React from "react"

/**
 * Flexible Badge component for status indicators
 */
export default function Badge({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  className = "",
  ...props
}) {
  const variants = {
    primary: "badge-primary",
    success: "badge-success",
    warning: "badge-warning",
    danger: "badge-danger",
    info: "badge-info",
    gray: "bg-gray-100 text-gray-700",
  }

  const sizes = {
    sm: "px-md py-sm text-xs",
    md: "px-md py-sm text-sm",
    lg: "px-lg py-md text-base",
  }

  return (
    <span
      className={`badge ${variants[variant]} ${sizes[size]} ${className}`}
      role="status"
      aria-label={typeof children === "string" ? children : undefined}
      {...props}
    >
      {Icon && <Icon size={size === "sm" ? 12 : size === "lg" ? 20 : 16} className="mr-sm" />}
      {children}
    </span>
  )
}
