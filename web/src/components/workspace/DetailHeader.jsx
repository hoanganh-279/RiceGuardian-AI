export function DetailHeader({ title, meta, actions, empty }) {
  if (empty) {
    return (
      <header className="rg-md-detail-head">
        <div>
          <h2 className="rg-md-detail-title text-muted">Chưa chọn mục</h2>
          <p className="rg-md-detail-meta mb-0">Chọn một đối tượng ở danh sách bên trái.</p>
        </div>
      </header>
    )
  }

  return (
    <header className="rg-md-detail-head">
      <div className="min-w-0">
        <h2 className="rg-md-detail-title">{title}</h2>
        {meta ? <p className="rg-md-detail-meta mb-0">{meta}</p> : null}
      </div>
      {actions ? <div className="rg-md-detail-actions">{actions}</div> : null}
    </header>
  )
}
