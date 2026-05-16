/**
 * useFormField.js - Hook para gerenciamento de campos com react-hook-form
 * 
 * Simplifica a integração de campos de formulário com validação,
 * erro e atributos ARIA automáticos.
 */

import { useCallback } from 'react'

/**
 * useFormField - Hook para field integration com react-hook-form
 * 
 * @param {Object} props
 * @param {Object} props.control - Controller do react-hook-form
 * @param {string} props.name - Nome do campo
 * @param {Object} props.formState - FormState do useForm
 * @returns {Object} Props para passar ao campo
 */
export const useFormField = ({ control, name, formState = {} }) => {
  const error = formState?.errors?.[name]?.message
  const isInvalid = !!error
  const fieldId = `field-${name}`
  const errorId = `error-${name}`
  const hintId = `hint-${name}`

  return {
    fieldId,
    errorId,
    hintId,
    error,
    isInvalid,
    ariaAttributes: {
      'aria-invalid': isInvalid,
      'aria-describedby': `${isInvalid ? errorId : ''} ${hintId}`.trim(),
    },
  }
}

/**
 * getFieldClasses - Retorna classes Tailwind baseadas no estado do campo
 * 
 * @param {boolean} isInvalid - Se o campo é inválido
 * @param {boolean} isDisabled - Se o campo está desabilitado
 * @returns {string} Classes Tailwind
 */
export const getFieldClasses = (isInvalid = false, isDisabled = false) => {
  const baseClasses = `
    inline-flex items-center justify-between
    rounded-2xl border px-3 py-2 text-sm
    bg-white transition-colors
    focus:outline-none focus:ring-2 focus:ring-offset-0
  `

  const errorClasses = isInvalid
    ? 'border-red-300 focus:ring-red-400 bg-red-50'
    : 'border-brand-navy/10 focus:ring-brand-blue bg-sand hover:border-brand-navy/20'

  const disabledClasses = isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''

  return `${baseClasses} ${errorClasses} ${disabledClasses}`.trim()
}

/**
 * ValidationSchema helper - Integra com Zod para validação
 * 
 * Exemplo:
 * ```
 * const schema = z.object({
 *   email: z.string().email('Email inválido'),
 *   name: z.string().min(3, 'Mínimo 3 caracteres'),
 *   classId: z.string().nonempty('Selecione uma turma'),
 * })
 * 
 * const { control, formState } = useForm({
 *   resolver: zodResolver(schema),
 * })
 * ```
 */

export default useFormField
