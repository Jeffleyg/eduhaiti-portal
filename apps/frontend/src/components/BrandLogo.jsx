/**
 * EduHaiti logo (a Nevvik group product). One component for every placement:
 * - variant: "horizontal" (default), "stacked" or "mark" (symbol only)
 * - tone: "color" (light backgrounds), "white" (dark backgrounds) or "mono"
 * - endorsed: adds the "by nevvik" signature (horizontal only)
 * Size it with a height class, e.g. className="h-9".
 */
const FILES = {
  horizontal: { color: "eduhaiti-logo", white: "eduhaiti-logo-white", mono: "eduhaiti-logo-mono" },
  endorsed: { color: "eduhaiti-logo-nevvik", white: "eduhaiti-logo-nevvik-white", mono: "eduhaiti-logo-mono" },
  stacked: { color: "eduhaiti-logo-stacked", white: "eduhaiti-logo-stacked-white", mono: "eduhaiti-logo-stacked" },
  mark: { color: "eduhaiti-mark", white: "eduhaiti-mark-white", mono: "eduhaiti-mark-mono" },
}

function brandLogoSrc({ variant = "horizontal", tone = "color", endorsed = false } = {}) {
  const set = endorsed && variant === "horizontal" ? FILES.endorsed : FILES[variant] ?? FILES.horizontal
  return `/brand/${set[tone] ?? set.color}.svg`
}

function BrandLogo({ variant = "horizontal", tone = "color", endorsed = false, alt = "EduHaiti", className = "h-9" }) {
  return <img src={brandLogoSrc({ variant, tone, endorsed })} alt={alt} className={`w-auto select-none ${className}`} draggable="false" />
}

export default BrandLogo
