import { METRIC_DASH } from '../../utils/metricDisplay.js'

const SEGMENTS = [
  { key: 'high', label: 'Cao', color: 'var(--rg-danger)' },
  { key: 'medium', label: 'Trung bình', color: 'var(--rg-secondary)' },
  { key: 'low', label: 'Thấp', color: 'var(--rg-primary)' },
]

export function RgDonutChart({ label = 'Phân bố mức độ' }) {
  const radius = 54

  return (
    <figure className="rg-chart-card">
      <figcaption>{label}</figcaption>
      <div className="rg-donut-wrap">
        <svg viewBox="0 0 160 160" className="rg-donut-svg" role="img" aria-label={label}>
          <title>{label}</title>
          <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--rg-line)" strokeWidth="18" />
          <text x="80" y="76" textAnchor="middle" className="rg-donut-total">
            {METRIC_DASH}
          </text>
          <text x="80" y="96" textAnchor="middle" className="rg-donut-sub">
            đang mở
          </text>
        </svg>
        <ul className="rg-donut-legend">
          {SEGMENTS.map((item) => (
            <li key={item.key}>
              <span className="rg-donut-swatch" style={{ background: item.color }} />
              {item.label} · {METRIC_DASH}
            </li>
          ))}
        </ul>
      </div>
    </figure>
  )
}
