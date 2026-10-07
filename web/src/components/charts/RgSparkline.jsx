export function RgSparkline({ points = [], label, color = 'var(--rg-secondary)' }) {
  const width = 220
  const height = 44
  const values = points.map((point) => (typeof point === 'number' ? point : Number(point.value) || 0))
  if (!values.length) return null
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const span = Math.max(1, values.length - 1)
  const coords = values.map((value, index) => {
    const x = (index / span) * width
    const y = height - 4 - ((value - min) / (max - min || 1)) * (height - 8)
    return `${x},${y}`
  })

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="rg-sparkline" role="img" aria-label={label}>
      <title>{label}</title>
      <polyline fill="none" stroke={color} strokeWidth="2" points={coords.join(' ')} />
    </svg>
  )
}
