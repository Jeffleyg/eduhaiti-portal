import React from "react"

export default function Input(props) {
  const { className = "", ...rest } = props
  return <input {...rest} className={`mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm ${className}`} />
}
