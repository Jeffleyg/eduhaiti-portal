import React from "react"
import { AlertCircle } from "lucide-react"

/**
 * Unified FormField component for all form inputs
 * Supports text, textarea, select, checkbox, radio, email, password, number
 */
export default function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  hint,
  placeholder,
  required = false,
  disabled = false,
  className = "",
  rows = 4,
  options = [],
  children,
  inputClassName = "",
  ...props
}) {
  const baseInputClass = "form-field"
  const errorClass = error ? "border-danger focus:ring-danger/20 focus:border-danger" : ""
  const disabledClass = disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""

  // Text inputs (text, email, password, number, etc.)
  if (["text", "email", "password", "number", "tel", "url"].includes(type)) {
    return (
      <div className={`flex flex-col ${className}`}>
        {label && (
          <label
            htmlFor={name}
            className="form-label"
            aria-required={required}
          >
            {label}
            {required && <span className="text-danger ml-sm">*</span>}
          </label>
        )}
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-label={label || name}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
          className={`${baseInputClass} ${errorClass} ${disabledClass} ${inputClassName}`}
          {...props}
        />
        {error && (
          <div id={`${name}-error`} className="form-error flex items-center gap-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {hint && !error && (
          <div id={`${name}-hint`} className="form-hint">
            {hint}
          </div>
        )}
      </div>
    )
  }

  // Textarea
  if (type === "textarea") {
    return (
      <div className={`flex flex-col ${className}`}>
        {label && (
          <label
            htmlFor={name}
            className="form-label"
            aria-required={required}
          >
            {label}
            {required && <span className="text-danger ml-sm">*</span>}
          </label>
        )}
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          rows={rows}
          aria-label={label || name}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
          className={`${baseInputClass} ${errorClass} ${disabledClass} resize-vertical ${inputClassName}`}
          {...props}
        />
        {error && (
          <div id={`${name}-error`} className="form-error flex items-center gap-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {hint && !error && (
          <div id={`${name}-hint`} className="form-hint">
            {hint}
          </div>
        )}
      </div>
    )
  }

  // Select
  if (type === "select") {
    return (
      <div className={`flex flex-col ${className}`}>
        {label && (
          <label
            htmlFor={name}
            className="form-label"
            aria-required={required}
          >
            {label}
            {required && <span className="text-danger ml-sm">*</span>}
          </label>
        )}
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          aria-label={label || name}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
          className={`${baseInputClass} ${errorClass} ${disabledClass} cursor-pointer ${inputClassName}`}
          {...props}
        >
          <option value="">{placeholder || ""}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <div id={`${name}-error`} className="form-error flex items-center gap-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {hint && !error && (
          <div id={`${name}-hint`} className="form-hint">
            {hint}
          </div>
        )}
      </div>
    )
  }

  // Checkbox
  if (type === "checkbox") {
    return (
      <div className={`flex items-center ${className}`}>
        <input
          id={name}
          name={name}
          type="checkbox"
          checked={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          aria-label={label || name}
          aria-required={required}
          aria-invalid={!!error}
          className="w-4 h-4 rounded border-gray-300 text-brand-red cursor-pointer"
          {...props}
        />
        {label && (
          <label htmlFor={name} className="ml-md cursor-pointer select-none">
            {label}
            {required && <span className="text-danger ml-sm">*</span>}
          </label>
        )}
        {error && (
          <div id={`${name}-error`} className="form-error ml-auto flex items-center gap-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </div>
    )
  }

  // Radio Group (when type="radio" and options provided)
  if (type === "radio") {
    return (
      <fieldset className={`flex flex-col ${className}`}>
        {label && (
          <legend className="form-label" aria-required={required}>
            {label}
            {required && <span className="text-danger ml-sm">*</span>}
          </legend>
        )}
        <div className="flex flex-col gap-md">
          {options.map((opt) => (
            <div key={opt.value} className="flex items-center">
              <input
                id={`${name}-${opt.value}`}
                name={name}
                type="radio"
                value={opt.value}
                checked={value === opt.value}
                onChange={onChange}
                onBlur={onBlur}
                disabled={disabled}
                required={required}
                aria-label={opt.label}
                className="w-4 h-4 cursor-pointer"
                {...props}
              />
              <label htmlFor={`${name}-${opt.value}`} className="ml-md cursor-pointer">
                {opt.label}
              </label>
            </div>
          ))}
        </div>
        {error && (
          <div className="form-error flex items-center gap-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {hint && !error && (
          <div className="form-hint">
            {hint}
          </div>
        )}
      </fieldset>
    )
  }

  // Custom children (for complex layouts)
  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label className="form-label" aria-required={required}>
          {label}
          {required && <span className="text-danger ml-sm">*</span>}
        </label>
      )}
      {children}
      {error && (
        <div className="form-error flex items-center gap-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      {hint && !error && (
        <div className="form-hint">
          {hint}
        </div>
      )}
    </div>
  )
}
