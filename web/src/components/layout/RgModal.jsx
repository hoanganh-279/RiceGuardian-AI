export function RgModal({ title, onClose, large, children }) {
  return (
    <div className="rg-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className={`rg-modal${large ? ' rg-modal-lg' : ''}`}
        role="dialog"
        aria-labelledby="rg-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        {title ? (
          <h2 id="rg-modal-title" className="h4 mb-3">
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </div>
  )
}
