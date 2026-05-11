import { ChevronRight, Edit2, Trash2, MoreVertical } from "lucide-react"
import { useState } from "react"

/**
 * ListItemCard - Card padrão para itens em listas
 * Utilizado em LoadMoreList e outras visualizações de itens
 * 
 * @param {Object} props
 * @param {string} props.id - Identificador único do item
 * @param {string} props.title - Título principal
 * @param {string} props.subtitle - Subtítulo/descrição (optional)
 * @param {JSX.Element} props.icon - Ícone visual (optional)
 * @param {JSX.Element} props.preview - Conteúdo de preview (optional)
 * @param {string} props.status - Status badge (optional)
 * @param {string} props.statusColor - Cor do status: "green" | "yellow" | "red" | "blue" (default: "blue")
 * @param {Array} props.tags - Array de tags [{label: "TAG1", color: "blue"}, ...] (optional)
 * @param {Array} props.actions - Array de ações [{label: "Editar", onClick: fn}, ...] (optional)
 * @param {Function} props.onEdit - Shortcut para ação Editar (optional)
 * @param {Function} props.onDelete - Shortcut para ação Deletar (optional)
 * @param {Function} props.onClick - Callback ao clicar no card (optional)
 * @param {boolean} props.isSelected - Se card está selecionado
 * @returns {JSX.Element}
 */
function ListItemCard({
  id,
  title,
  subtitle,
  icon,
  preview,
  status,
  statusColor = "blue",
  tags = [],
  actions = [],
  onEdit,
  onDelete,
  onClick,
  isSelected = false,
}) {
  const [showActions, setShowActions] = useState(false)

  const statusColors = {
    green: "bg-emerald-100 text-emerald-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  }

  const defaultActions = []
  if (onEdit) {
    defaultActions.push({
      label: "Editar",
      onClick: onEdit,
      icon: <Edit2 size={14} />,
    })
  }
  if (onDelete) {
    defaultActions.push({
      label: "Deletar",
      onClick: onDelete,
      icon: <Trash2 size={14} />,
      isDangerous: true,
    })
  }

  const allActions = [...defaultActions, ...actions]

  return (
    <div
      className={`rounded-lg border-2 transition-all cursor-pointer ${
        isSelected
          ? "border-brand-navy bg-blue-50"
          : "border-brand-navy/10 hover:border-brand-navy/30 hover:shadow-md"
      }`}
      onClick={() => onClick?.(id)}
    >
      <div className="p-4">
        {/* Header com Ícone e Título */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            {icon && <div className="mt-1 flex-shrink-0">{icon}</div>}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-brand-navy truncate">
                {title}
              </h3>
              {subtitle && (
                <p className="mt-1 text-xs text-brand-navy/60 line-clamp-2">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Status Badge */}
          {status && (
            <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap flex-shrink-0 ${statusColors[statusColor]}`}>
              {status}
            </span>
          )}
        </div>

        {/* Preview Content */}
        {preview && <div className="mt-3 text-xs text-brand-navy/70">{preview}</div>}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  tag.color === "gray"
                    ? "bg-gray-100 text-gray-700"
                    : `bg-${tag.color}-100 text-${tag.color}-700`
                }`}
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}

        {/* Actions Footer */}
        {allActions.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-brand-navy/5 pt-3">
            {/* Ações visíveis (até 2) */}
            <div className="flex gap-2">
              {allActions.slice(0, 2).map((action, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation()
                    action.onClick?.()
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    action.isDangerous
                      ? "text-red-600 hover:bg-red-50"
                      : "text-brand-navy/70 hover:bg-brand-navy/5"
                  }`}
                  title={action.label}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>

            {/* Menu de mais ações */}
            {allActions.length > 2 && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowActions(!showActions)
                  }}
                  className="p-1 rounded text-brand-navy/70 hover:bg-brand-navy/5"
                >
                  <MoreVertical size={16} />
                </button>

                {showActions && (
                  <div className="absolute right-0 mt-1 bg-white border border-brand-navy/10 rounded-lg shadow-lg z-10 min-w-max">
                    {allActions.slice(2).map((action, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation()
                          action.onClick?.()
                          setShowActions(false)
                        }}
                        className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-brand-navy/5 transition-colors ${
                          action.isDangerous ? "text-red-600" : "text-brand-navy/70"
                        }`}
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ListItemCard
