import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import PaginationControls from "./PaginationControls.jsx"
import SkeletonLoader from "./SkeletonLoader.jsx"

/**
 * DataTablePaginated - Tabela com paginação, carregamento de esqueleto e contagem
 * Usa o padrão de paginação profissional do sistema
 * 
 * @param {Object} props
 * @param {Array} props.columns - Definição das colunas [{key: "name", label: "Nome"}, ...]
 * @param {Array} props.rows - Dados da tabela
 * @param {number} props.itemsPerPage - Itens por página (default: 10)
 * @param {number} props.totalCount - Total de registros (para exibição)
 * @param {boolean} props.loading - Estado de carregamento
 * @param {string} props.emptyMessage - Mensagem quando vazio
 * @param {Function} props.onRowClick - Callback ao clicar em linha (optional)
 * @returns {JSX.Element}
 */
function DataTablePaginated({
  columns = [],
  rows = [],
  itemsPerPage = 10,
  pageSize = null,
  totalCount = null,
  loading = false,
  emptyMessage = null,
  onRowClick = null,
}) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [displayRows, setDisplayRows] = useState([])
  const pageLimit = pageSize ?? itemsPerPage

  // Calcular paginação
  const actualTotal = totalCount ?? rows.length
  const totalPages = Math.max(1, Math.ceil(rows.length / pageLimit))
  const start = (page - 1) * pageLimit
  const end = start + pageLimit

  // Ajustar página se necessário
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  // Atualizar linhas exibidas
  useEffect(() => {
    setDisplayRows(rows.slice(start, end))
  }, [rows, page, pageLimit, start, end])

  // Estado vazio
  if (!loading && rows.length === 0) {
    const message = emptyMessage || t("noData") || "Nenhum dado disponível"
    return (
      <div className="rounded-2xl border border-brand-navy/10 bg-white p-8 text-center text-sm text-brand-navy/60">
        {message}
      </div>
    )
  }

  // Estado de carregamento
  if (loading) {
    return <SkeletonLoader type="table" count={pageLimit} />
  }

  const safePage = Math.min(page, totalPages)

  return (
    <div>
      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-brand-navy/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-navy text-white">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em]"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {displayRows.map((row, index) => (
              <tr
                key={row.id ?? index}
                className={`border-t border-brand-navy/10 ${
                  onRowClick ? "cursor-pointer hover:bg-sand" : ""
                }`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-brand-navy/80">
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info de Paginação */}
      {totalPages > 1 && (
        <div className="mt-3 text-right text-xs text-brand-navy/60">
          Exibindo {start + 1} a {Math.min(end, rows.length)} de {actualTotal} registros
        </div>
      )}

      {/* Controles de Paginação */}
      {totalPages > 1 && (
        <PaginationControls
          currentPage={safePage}
          totalPages={totalPages}
          previousLabel={t("previous") ?? "Previous"}
          continueLabel={t("continue") ?? "Next"}
          onPrevious={() => setPage((prev) => Math.max(1, prev - 1))}
          onContinue={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        />
      )}
    </div>
  )
}

export default DataTablePaginated
