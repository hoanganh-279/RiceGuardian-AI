export function DataTable({
  columns,
  rows,
  rowKey = 'id',
  selectedId,
  onSelectRow,
  selectable,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onEditRow,
  onDeleteRow,
  empty = 'Không có dữ liệu.',
}) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds?.has(row[rowKey]))
  const showActions = Boolean(onEditRow || onDeleteRow)

  return (
    <div className="rg-md-table-wrap">
      <table className="rg-table rg-md-table">
        <thead>
          <tr>
            {selectable ? (
              <th className="rg-md-check">
                <input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="Chọn tất cả" />
              </th>
            ) : null}
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
            {showActions ? <th className="rg-md-actions"> </th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0) + (showActions ? 1 : 0)} className="text-muted">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const id = row[rowKey]
              return (
                <tr
                  key={id}
                  className={selectedId === id ? 'rg-md-row-active' : ''}
                  data-clickable={onSelectRow ? 'true' : undefined}
                  onClick={onSelectRow ? () => onSelectRow(row) : undefined}
                >
                  {selectable ? (
                    <td className="rg-md-check" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedIds?.has(id))}
                        onChange={() => onToggleRow(id)}
                        aria-label="Chọn hàng"
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
                  ))}
                  {showActions ? (
                    <td className="rg-md-actions" onClick={(event) => event.stopPropagation()}>
                      {onEditRow ? (
                        <button
                          type="button"
                          className="rg-icon-edit"
                          aria-label="Sửa"
                          onClick={() => onEditRow(row)}
                        >
                          <i className="bi bi-pencil" aria-hidden="true" />
                        </button>
                      ) : null}
                      {onDeleteRow ? (
                        <button
                          type="button"
                          className="rg-icon-danger"
                          aria-label="Xóa"
                          onClick={() => onDeleteRow(row)}
                        >
                          <i className="bi bi-trash" aria-hidden="true" />
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
