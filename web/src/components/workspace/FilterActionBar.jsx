export function FilterActionBar({
  search,
  onSearch,
  searchPlaceholder = 'Tìm kiếm…',
  filterValue,
  onFilter,
  filterOptions,
  onApply,
  resultCount,
  selectedCount = 0,
  onBatchDelete,
  extra,
}) {
  return (
    <div className="rg-md-toolbar">
      <input
        type="search"
        className="form-control form-control-sm rg-md-search"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(event) => onSearch(event.target.value)}
      />
      {filterOptions?.length ? (
        <select className="form-select form-select-sm rg-md-filter" value={filterValue} onChange={(event) => onFilter(event.target.value)}>
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}
      {onApply ? (
        <button type="button" className="btn btn-sm btn-rg-outline" onClick={onApply}>
          Lọc
        </button>
      ) : null}
      <span className="rg-md-count">{resultCount} kết quả</span>
      {selectedCount > 0 && onBatchDelete ? (
        <button type="button" className="btn btn-sm btn-rg-danger" onClick={onBatchDelete}>
          Xóa {selectedCount} mục
        </button>
      ) : null}
      {extra}
    </div>
  )
}
