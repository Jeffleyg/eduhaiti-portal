import { Component } from "react"
import { AlertTriangle } from "lucide-react"
import i18n from "../i18n.js"

/**
 * Catches render errors so a broken page shows a message instead of a blank
 * screen. `resetKey` (e.g. the pathname) clears the error when it changes, so
 * navigating to another page recovers without a reload.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, resetKey: props.resetKey }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey }
    }
    return null
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    const t = i18n.t.bind(i18n)
    return (
      <div role="alert" className="mx-auto my-10 max-w-md rounded-3xl border border-brand-navy/10 bg-white/90 p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
        <h2 className="mt-3 font-display text-xl text-brand-navy">{t("pageErrorTitle")}</h2>
        <p className="mt-2 text-sm text-brand-navy/70">{t("pageErrorText")}</p>
        <button type="button" className="primary-button mt-5" onClick={() => window.location.reload()}>
          {t("reloadPage")}
        </button>
      </div>
    )
  }
}

export default ErrorBoundary
