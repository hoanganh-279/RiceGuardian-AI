import { FEATURES } from '../../constants/features.js'

const RISK = ['high', 'medium', 'low', 'medium', 'low']

export function FeatureMeta({ code }) {
  const feature = FEATURES[code]
  if (!feature?.role) return null
  return (
    <div className="rg-meta mb-3">
      <span>Vai trò: {feature.role}</span>
      <span>Phạm vi: {feature.scope}</span>
      <span>Cấp UX: {feature.ux}</span>
      <span>Nguồn: {feature.source}</span>
    </div>
  )
}

export function PlaceholderChrome({ kind = 'table', columns = [], rows = 5, fields = [] }) {
  if (kind === 'map') {
    return (
      <div className="rg-map-canvas" aria-hidden="true">
        <svg viewBox="0 0 640 360" className="rg-map-svg">
          <polygon points="40,80 180,50 220,160 70,210" className="rg-map-poly rg-risk-high" />
          <polygon points="230,40 390,70 360,190 200,170" className="rg-map-poly rg-risk-medium" />
          <polygon points="400,90 600,60 580,220 410,240" className="rg-map-poly rg-risk-low" />
          <polygon points="80,230 250,250 220,330 50,310" className="rg-map-poly rg-risk-medium" />
          <polygon points="280,230 520,250 500,340 270,320" className="rg-map-poly rg-risk-low" />
        </svg>
      </div>
    )
  }

  if (kind === 'cards') {
    return (
      <div className="rg-card-grid">
        {Array.from({ length: 3 }, (_, index) => (
          <article key={index} className="rg-card-skel">
            <span className={`rg-risk-bar rg-risk-${RISK[index]}`} />
            <div>
              <div className="rg-skel rg-skel-title" />
              <div className="rg-skel" />
            </div>
          </article>
        ))}
      </div>
    )
  }

  if (kind === 'form') {
    return (
      <div className="rg-form-skel">
        {(fields.length ? fields : ['Trường 1', 'Trường 2', 'Trường 3']).map((label) => (
          <label key={label} className="d-block mb-3">
            <span className="form-label">{label}</span>
            <div className="rg-skel rg-skel-input" />
          </label>
        ))}
      </div>
    )
  }

  if (kind === 'timeseries') {
    return (
      <div className="rg-timeseries" aria-hidden="true">
        <svg viewBox="0 0 640 180" className="w-100">
          <polyline
            fill="none"
            stroke="var(--rg-primary)"
            strokeWidth="2.5"
            points="20,120 80,90 140,100 200,70 260,85 320,55 380,75 440,40 500,60 580,35"
          />
          <line x1="20" y1="150" x2="620" y2="150" stroke="var(--rg-line)" />
        </svg>
        <p className="small text-muted mb-0">Trục thời gian — chưa gắn chuỗi cảm biến</p>
      </div>
    )
  }

  if (kind === 'gallery') {
    return (
      <div className="rg-gallery">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={`rg-gallery-cell rg-risk-${RISK[index]}`} />
        ))}
      </div>
    )
  }

  if (kind === 'monitor') {
    return (
      <div className="rg-stat-row">
        {['IoT online', 'Đồng bộ App', 'Độ trễ API'].map((label, index) => (
          <article key={label} className="rg-stat">
            <span className={`rg-risk-bar rg-risk-${RISK[index]}`} />
            <div>
              <p className="small text-muted mb-0">{label}</p>
              <div className="rg-skel rg-skel-title mt-2" />
            </div>
          </article>
        ))}
      </div>
    )
  }

  const cols = columns.length ? columns : ['Cột 1', 'Cột 2', 'Cột 3', 'Cột 4']
  return (
    <div className="table-responsive">
      <table className="rg-table">
        <thead>
          <tr>
            {cols.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {cols.map((col) => (
                <td key={col}>
                  <div className="rg-skel" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
