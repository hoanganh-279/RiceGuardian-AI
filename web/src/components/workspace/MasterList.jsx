export function MasterList({ title, onAdd, addLabel = 'Thêm', children, empty, isEmpty }) {
  return (
    <div className="rg-md-master-inner">
      <header className="rg-md-master-head">
        <h2 className="rg-md-master-title">{title}</h2>
        {onAdd ? (
          <button type="button" className="btn btn-sm btn-rg rg-md-add" onClick={onAdd} aria-label={addLabel}>
            <i className="bi bi-plus-lg" aria-hidden="true" />
          </button>
        ) : null}
      </header>
      <div className="rg-md-master-scroll">
        {isEmpty ? <p className="small text-muted px-3 py-2 mb-0">{empty || 'Không có mục nào.'}</p> : children}
      </div>
    </div>
  )
}

export function MasterItem({ active, onClick, title, subtitle, meta, badge }) {
  return (
    <button type="button" className={`rg-md-item${active ? ' active' : ''}`} onClick={onClick}>
      <span className="rg-md-item-title">{title}</span>
      {subtitle ? <span className="rg-md-item-sub">{subtitle}</span> : null}
      {meta ? <span className="rg-md-item-meta">{meta}</span> : null}
      {badge ? <span className="rg-md-item-badge">{badge}</span> : null}
    </button>
  )
}
