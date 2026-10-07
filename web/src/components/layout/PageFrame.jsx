export function PageFrame({ code: _code, title, description, banner, actions, filters, children }) {
  return (
    <section>
      <div className="d-flex flex-wrap justify-content-between gap-2 align-items-start mb-2">
        <h1 className="mb-0">{title}</h1>
        {actions ? <div className="d-flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {description ? <p className="text-muted mb-3">{description}</p> : null}
      {banner ? <p className="rg-placeholder-banner">{banner}</p> : null}
      {filters}
      {children}
    </section>
  )
}
