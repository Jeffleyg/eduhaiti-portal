import { AlertCircle, Wifi } from "lucide-react"

/**
 * Banner exibido quando uma requisição é bloqueada no modo de sobrevivência
 */
function SurvivalModeBlockedBanner({ message, reason = "non-essential", onDismiss }) {
  const reasonText = {
    "non-essential": "Este recurso não é essencial e está bloqueado para economizar dados",
    "low-battery": "Desabilitado com bateria baixa",
    "slow-network": "Desabilitado em rede lenta",
    "data-saver": "Modo de economias de dados ativado",
  }[reason]

  return (
    <div className="mb-4 flex gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Wifi className="h-4 w-4 text-orange-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-orange-900">Modo de sobrevivência ativo</p>
          <p className="text-xs text-orange-800">{message || reasonText}</p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 text-orange-600 hover:text-orange-800"
            aria-label="Descartar"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default SurvivalModeBlockedBanner
