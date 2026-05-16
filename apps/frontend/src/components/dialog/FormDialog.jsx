/**
 * FormDialog.jsx - Modal de Formulário com Radix UI + react-hook-form
 * 
 * Fornece um diálogo reutilizável para formulários com:
 * - Focus trap automático (Radix Dialog)
 * - Fechamento com ESC (automático)
 * - Validação com react-hook-form
 * - WCAG 2.1 AA compliance
 */

import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import Button from '../Button'
import { useTranslation } from 'react-i18next'

/**
 * FormDialog - Diálogo para formulários
 * 
 * @param {Object} props
 * @param {string} props.title - Título do diálogo
 * @param {string} props.description - Descrição (opcional)
 * @param {boolean} props.isOpen - Estado aberto/fechado
 * @param {Function} props.onClose - Callback ao fechar
 * @param {Function} props.onSubmit - Callback ao enviar (recebe FormData)
 * @param {React.ReactNode} props.children - Campos do formulário
 * @param {string} props.submitText - Texto do botão submit
 * @param {string} props.cancelText - Texto do botão cancel
 * @param {boolean} props.isLoading - Estado de carregamento
 * @param {boolean} props.isDone - Estado de conclusão (para desabilitar)
 * @param {boolean} props.hideCancel - Esconder botão cancelar
 * @param {Function} props.validate - Validação customizada (opcional)
 */
export const FormDialog = ({
  title,
  description,
  isOpen,
  onClose,
  onSubmit,
  children,
  submitText = 'Save',
  cancelText = 'Cancel',
  isLoading = false,
  isDone = false,
  hideCancel = false,
  validate,
  className = '',
}) => {
  const { t } = useTranslation()
  const [errors, setErrors] = React.useState({})
  const formRef = React.useRef(null)

  // Resetar erros ao abrir/fechar
  React.useEffect(() => {
    if (isOpen) {
      setErrors({})
    }
  }, [isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Obter dados do formulário
    const formData = new FormData(formRef.current)
    const data = Object.fromEntries(formData)

    // Validação customizada
    if (validate) {
      const validationErrors = await validate(data)
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors)
        return
      }
    }

    // Submeter
    try {
      await onSubmit(data)
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        {/* Backdrop com overlay */}
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Dialog Content */}
        <Dialog.Content
          className="
            fixed left-1/2 top-1/2 z-50 w-full max-w-lg
            -translate-x-1/2 -translate-y-1/2
            rounded-2xl bg-white shadow-xl
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
            data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
            data-[state=closed]:slide-out-to-left-1/2
            data-[state=closed]:slide-out-to-top-[48%]
            data-[state=open]:slide-in-from-left-1/2
            data-[state=open]:slide-in-from-top-[48%]
            duration-300 ease-out
            mx-4
          "
          aria-describedby={description ? 'dialog-description' : undefined}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-brand-navy/10 px-6 py-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-brand-navy">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description
                  id="dialog-description"
                  className="mt-1 text-sm text-brand-navy/60"
                >
                  {description}
                </Dialog.Description>
              )}
            </div>

            {/* Close Button */}
            <Dialog.Close asChild>
              <button
                className="
                  inline-flex h-8 w-8 items-center justify-center rounded
                  text-brand-navy/50 hover:bg-brand-navy/5
                  focus:outline-none focus:ring-2 focus:ring-brand-blue
                  transition-colors
                "
                aria-label="Fechar diálogo"
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          {/* Form Content */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className={`flex flex-col gap-4 px-6 py-4 ${className}`}
            noValidate
          >
            {children}
          </form>

          {/* Footer com Actions */}
          <div className="flex gap-3 border-t border-brand-navy/10 px-6 py-4 justify-end">
            {!hideCancel && (
              <Dialog.Close asChild>
                <Button
                  variant="secondary"
                  disabled={isLoading}
                  onClick={() => {
                    setErrors({})
                    onClose()
                  }}
                >
                  {cancelText}
                </Button>
              </Dialog.Close>
            )}
            <Button
              variant="primary"
              type="submit"
              disabled={isLoading || isDone}
              isLoading={isLoading}
              onClick={handleSubmit}
            >
              {submitText}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default FormDialog
