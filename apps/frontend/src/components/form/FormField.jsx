/**
 * FormField.jsx - Componente de campo de formulário com react-hook-form
 * 
 * Wrapper que integra com react-hook-form Controller para gerenciar estado
 * Fornece validação automática, erro visual e acessibilidade WCAG 2.1 AA
 */

import React from 'react'
import { Controller } from 'react-hook-form'
import { AlertCircle } from 'lucide-react'

/**
 * FormField - Campo de formulário com react-hook-form Controller
 * 
 * @param {Object} props
 * @param {Object} props.control - Controller do react-hook-form
 * @param {string} props.name - Nome do campo (deve estar no schema Zod)
 * @param {string} props.label - Label do campo
 * @param {string} props.type - Tipo de input (text, email, password, date, textarea, etc.)
 * @param {string} props.placeholder - Placeholder
 * @param {boolean} props.required - Campo obrigatório (mostra *)
 * @param {string} props.error - Mensagem de erro (vem de formState.errors)
 * @param {string} props.hint - Dica/ajuda (mostrada embaixo)
 * @param {boolean} props.disabled - Campo desabilitado
 * @param {string} props.className - Classes Tailwind extras
 */
export const FormField = ({
  control,
  name,
  label,
  type = 'text',
  placeholder,
  required = false,
  error,
  hint,
  disabled = false,
  className = '',
  rows = 4,
  ...props
}) => {
  const fieldId = `field-${name}`
  const errorId = `error-${name}`
  const hintId = `hint-${name}`

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        // Classes dinâmicas
        const baseClasses = `
          w-full rounded-2xl px-3 py-2 text-sm
          border transition-colors
          focus:outline-none focus:ring-2 focus:ring-offset-0
        `

        const errorClasses = error
          ? 'border-red-300 bg-red-50 focus:ring-red-400'
          : 'border-brand-navy/10 bg-sand focus:ring-brand-blue hover:border-brand-navy/20'

        const disabledClasses = disabled
          ? 'opacity-50 cursor-not-allowed bg-gray-100'
          : ''

        const inputClasses = `${baseClasses} ${errorClasses} ${disabledClasses}`.trim()

        // Render textarea
        if (type === 'textarea') {
          return (
            <div className={`flex flex-col gap-2 ${className}`}>
              {label && (
                <label
                  htmlFor={fieldId}
                  className="text-sm font-medium text-brand-navy"
                >
                  {label}
                  {required && <span className="ml-1 text-red-500">*</span>}
                </label>
              )}

              <textarea
                id={fieldId}
                {...field}
                placeholder={placeholder}
                disabled={disabled}
                rows={rows}
                aria-label={label || name}
                aria-required={required}
                aria-invalid={!!error}
                aria-describedby={`${error ? errorId : ''} ${hint ? hintId : ''}`.trim()}
                className={inputClasses}
                {...props}
              />

              {error && (
                <div
                  id={errorId}
                  className="flex items-center gap-1 text-sm text-red-600"
                  role="alert"
                >
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {hint && !error && (
                <p id={hintId} className="text-xs text-brand-navy/60">
                  {hint}
                </p>
              )}
            </div>
          )
        }

        // Render input (text, email, date, etc.)
        return (
          <div className={`flex flex-col gap-2 ${className}`}>
            {label && (
              <label
                htmlFor={fieldId}
                className="text-sm font-medium text-brand-navy"
              >
                {label}
                {required && <span className="ml-1 text-red-500">*</span>}
              </label>
            )}

            <input
              id={fieldId}
              {...field}
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              aria-label={label || name}
              aria-required={required}
              aria-invalid={!!error}
              aria-describedby={`${error ? errorId : ''} ${hint ? hintId : ''}`.trim()}
              className={inputClasses}
              {...props}
            />

            {error && (
              <div
                id={errorId}
                className="flex items-center gap-1 text-sm text-red-600"
                role="alert"
              >
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {hint && !error && (
              <p id={hintId} className="text-xs text-brand-navy/60">
                {hint}
              </p>
            )}
          </div>
        )
      }}
    />
  )
}

export default FormField
