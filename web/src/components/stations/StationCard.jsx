import { Link } from 'react-router-dom'
import { SENSOR_METRICS, formatMetricValue } from '../../constants/sensors.js'

function formatWhen(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export function StationCard({ station, sensorsHref, manageHref }) {
  const latest = station.latest
  const statusClass = station.online ? 'rg-risk-low' : 'rg-risk-high'
  return (
    <article className="rg-station-card">
      <span className={`rg-risk-bar ${station.issue ? 'rg-risk-medium' : statusClass}`} />
      <div className="rg-station-card-body">
        <header className="mb-2">
          {station.orgName ? <span className="rg-org-label">{station.orgName}</span> : null}
          <h2 className="h5 mb-1">{station.code}</h2>
          <p className="small text-muted mb-0">{station.name || station.fieldName}</p>
          <div className="rg-meta mt-1">
            <span>{station.fieldName || 'Chưa gán thửa'}</span>
            <span>{station.online ? 'Online' : 'Offline'}</span>
            <span>Pin {station.batteryPct ?? '—'}%</span>
          </div>
          {station.issue ? <p className="small text-danger mb-0 mt-1">{station.issue}</p> : null}
        </header>
        <div className="rg-station-metrics mb-2">
          {SENSOR_METRICS.map((metric) => (
            <div key={metric.key}>
              <span className="rg-station-metric-label">{metric.short}</span>
              <strong>{latest ? formatMetricValue(metric.key, latest[metric.key]) : '—'}</strong>
            </div>
          ))}
        </div>
        <p className="small text-muted mb-2">Cập nhật {formatWhen(latest?.recordedAt || station.lastSeenAt)}</p>
        <div className="rg-station-cells" role="group" aria-label="Thao tác trạm">
          <Link className="rg-station-cell rg-station-cell--sensors" to={sensorsHref}>
            Cảm biến
          </Link>
          <Link className="rg-station-cell rg-station-cell--manage" to={manageHref}>
            Quản lý
          </Link>
        </div>
      </div>
    </article>
  )
}

export function StationGrid({ stations, role, sensorsPath, managePath }) {
  if (!stations.length) {
    return <p className="text-muted">Chưa có trạm trong phạm vi đang xem.</p>
  }
  return (
    <div className="rg-station-grid">
      {stations.map((station) => (
        <StationCard
          key={station.id}
          station={station}
          sensorsHref={sensorsPath(role, station.id)}
          manageHref={managePath(role, station.id)}
        />
      ))}
    </div>
  )
}
