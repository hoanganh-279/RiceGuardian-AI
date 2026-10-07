import { METRIC_DASH } from '../../utils/metricDisplay.js'

export function RgRankBars({ items = [], label = 'Vùng có nhiều cảnh báo nhất' }) {
  return (
    <section className="rg-chart-card">
      <h2 className="h6 mb-3">{label}</h2>
      {items.length === 0 ? <p className="text-muted mb-0">Chưa có cảnh báo đang mở.</p> : null}
      <ul className="rg-rank-list">
        {items.map((item) => (
          <li key={item.id}>
            <div className="d-flex justify-content-between gap-2">
              <div>
                {item.orgName ? <span className="rg-org-label">{item.orgName}</span> : null}
                <strong className="d-block">{item.name}</strong>
              </div>
              <span className="text-muted">{METRIC_DASH}</span>
            </div>
            <div className="rg-rank-track" aria-hidden="true">
              <span className="rg-rank-bar" style={{ width: '0%' }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
