/**
 * SelectField.jsx - Wrapper de Select com Radix UI
 * 
 * Fornece um select acessível com WCAG 2.1 AA compliance:
 * - Keyboard navigation (Tab, Arrow keys)
 * - Screen reader support (aria-*)
 * - Validação com react-hook-form
 * - Styling com Tailwind
 */

import React from 'react'
import * as Select from '@radix-ui/react-select'
import { ChevronDown, AlertCircle } from 'lucide-react'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

/**
 * SelectField - Componente controlado com react-hook-form
 * 
 * @param {Object} props
 * @param {Object} props.control - Controller do react-hook-form
 * @param {string} props.name - Nome do campo
 * @param {string} props.label - Label do campo
 * @param {Array} props.options - Opções [{label, value}, ...]
 * @param {string} props.placeholder - Placeholder padrão
 * @param {boolean} props.required - Campo obrigatório
 * @param {string} props.error - Mensagem de erro
 * @param {string} props.hint - Dica/ajuda
 * @param {boolean} props.disabled - Campo desabilitado
 */
export const SelectField = ({
  control,
  name,
  label,
  options = [],
  placeholder = 'Selecione...',
  required = false,
  error,
  hint,
  disabled = false,
  className = '',
}) => {
  const { t } = useTranslation()
  const fieldId = `field-${name}`
  const errorId = `error-${name}`
  const hintId = `hint-${name}`

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
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

          <Select.Root
            value={field.value || ''}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <Select.Trigger
              id={fieldId}
              aria-label={label || name}
              aria-required={required}
              aria-invalid={!!error}
              aria-describedby={`${error ? errorId : ''} ${hint ? hintId : ''}`}
              className={`
                inline-flex items-center justify-between
                rounded-2xl border px-3 py-2 text-sm
                bg-white transition-colors
                focus:outline-none focus:ring-2 focus:ring-offset-0
                ${
                  error
                    ? 'border-red-300 focus:ring-red-400 bg-red-50'
                    : 'border-brand-navy/10 focus:ring-brand-blue bg-sand hover:border-brand-navy/20'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'cursor-pointer'}
              `}
            >
              <Select.Value placeholder={placeholder} />
              <Select.Icon className="ml-2">
                <ChevronDown size={16} className="text-brand-navy/50" />
              </Select.Icon>
            </Select.Trigger>

            <Select.Portal>
              <Select.Content
                className="
                  overflow-hidden rounded-lg bg-white shadow-lg
                  border border-brand-navy/10 z-50
                "
                position="popper"
                sideOffset={4}
              >
                <Select.ScrollUpButton className="flex justify-center py-1">
                  <ChevronDown size={16} className="rotate-180" />
                </Select.ScrollUpButton>

                <Select.Viewport className="p-1">
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </Select.Viewport>

                <Select.ScrollDownButton className="flex justify-center py-1">
                  <ChevronDown size={16} />
                </Select.ScrollDownButton>
              </Select.Content>
            </Select.Portal>
          </Select.Root>

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
      )}
    />
  )
}

/**
 * SelectItem - Item interno do Select
 * Componente interno que renderiza cada opção
 */
const SelectItem = React.forwardRef(({ children, ...props }, ref) => (
  <Select.Item
    ref={ref}
    {...props}
    className="
      relative flex items-center px-3 py-2 rounded cursor-pointer
      select-none focus:outline-none
      data-[highlighted]:bg-brand-blue/10
      data-[state=checked]:bg-brand-blue/20
      text-sm hover:bg-brand-navy/5
    "
  >
    <Select.ItemText>{children}</Select.ItemText>
    <Select.ItemIndicator className="ml-auto text-brand-blue font-semibold">
      ✓
    </Select.ItemIndicator>
  </Select.Item>
))

SelectItem.displayName = 'SelectItem'

export default SelectField
