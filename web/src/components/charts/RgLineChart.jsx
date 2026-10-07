import { METRIC_DASH } from '../../utils/metricDisplay.js'

export function RgLineChart({ points = [], label = 'Xu hướng', color = 'var(--rg-secondary)' }) {
  const width = 640
  const height = 200
  const pad = { left: 36, right: 12, top: 16, bottom: 36 }
  const span = Math.max(1, points.length - 1)
  const coords = points.map((point, index) => {
    const x = pad.left + (index / span) * (width - pad.left - pad.right)
    const y = pad.top + (height - pad.top - pad.bottom) / 2
    return { x, y, ...point }
  })
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')

  return (
    <figure className="rg-chart-card">
      <figcaption>{label}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="rg-chart-svg" role="img" aria-label={label}>
        <title>{label}</title>
        {[0, 0.5, 1].map((ratio) => {
          const y = pad.top + (1 - ratio) * (height - pad.top - pad.bottom)
          return (
            <g key={ratio}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="rg-chart-grid" />
              <text x={pad.left - 8} y={y + 4} className="rg-chart-axis" textAnchor="end">
                {METRIC_DASH}
              </text>
            </g>
          )
        })}
        {path ? (
          <path d={path} fill="none" stroke={color} strokeWidth="2.6" strokeLinejoin="round" opacity="0.35" />
        ) : null}
        {coords.map((point) => (
          <text
            key={`l-${point.key || point.label}`}
            x={point.x}
            y={height - 10}
            className="rg-chart-axis"
            textAnchor="middle"
          >
            {point.label}
          </text>
        ))}
      </svg>
    </figure>
  )
}
