import React from "react"

export default function Button({ variant = "outline", children, disabled, onClick, type = "button" }) {
  const base = "rounded-2xl px-4 py-2 text-sm font-semibold shadow-sm"
  const variants = {
    primary: "bg-brand-red text-white hover:brightness-95",
    outline: "border border-brand-navy/10 text-brand-navy bg-white",
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      {children}
    </button>
  )
}
