import React from "react"
import { AlertCircle, CheckCircle, Loader } from "lucide-react"
import "../styles/LoadingState.css"

/**
 * Componente de estado de carregamento seguro
 * Mostra feedback visual consistente durante operações
 */
function LoadingState({ 
  isLoading, 
  error, 
  success, 
  message, 
  type = "inline",
  fullHeight = false 
}) {
  // Inline loading (dentro de um container)
  if (type === "inline") {
    return (
      <div className={`loading-state-inline ${isLoading ? "active" : ""} ${fullHeight ? "full-height" : ""}`}>
        {isLoading && (
          <div className="loading-content">
            <Loader className="loading-spinner" />
            <p className="loading-text">{message || "Carregando..."}</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="error-state">
            <AlertCircle className="error-icon" />
            <p className="error-text">{error}</p>
          </div>
        )}

        {success && !isLoading && !error && (
          <div className="success-state">
            <CheckCircle className="success-icon" />
            <p className="success-text">{message || "Concluído com sucesso!"}</p>
          </div>
        )}
      </div>
    )
  }

  // Overlay loading (cobre a tela)
  if (type === "overlay") {
    return (
      <div className={`loading-state-overlay ${isLoading ? "active" : ""}`}>
        <div className="loading-backdrop" />
        <div className="loading-content-overlay">
          <Loader className="loading-spinner-lg" />
          <p className="loading-text-overlay">{message || "Processando..."}</p>
        </div>
      </div>
    )
  }

  // Minimal loading (apenas indicador)
  if (type === "minimal") {
    return (
      <div className={`loading-state-minimal ${isLoading ? "active" : ""}`}>
        {isLoading && <Loader className="loading-spinner-sm" />}
        {error && <AlertCircle className="error-icon-sm" />}
        {success && <CheckCircle className="success-icon-sm" />}
      </div>
    )
  }

  // Banner loading (no topo/fundo)
  if (type === "banner") {
    return (
      <div className={`loading-state-banner ${isLoading ? "active" : ""}`}>
        <div className="banner-content">
          {isLoading && (
            <>
              <Loader className="banner-spinner" />
              <span>{message || "Processando..."}</span>
            </>
          )}
          {error && (
            <>
              <AlertCircle className="banner-error-icon" />
              <span>{error}</span>
            </>
          )}
          {success && (
            <>
              <CheckCircle className="banner-success-icon" />
              <span>{message || "Sucesso!"}</span>
            </>
          )}
        </div>
      </div>
    )
  }

  return null
}

export default LoadingState
