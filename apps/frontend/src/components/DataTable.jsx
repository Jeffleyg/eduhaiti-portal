function DataTable({ columns, rows }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-navy/10">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-brand-navy text-white">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em]">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-brand-navy/10">
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
  )
}

export default DataTable
