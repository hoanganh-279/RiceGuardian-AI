import { RgSparkline } from '../charts/RgSparkline.jsx'
import { METRIC_DASH } from '../../utils/metricDisplay.js'

function formatWhen(iso) {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export function SystemHealthDashboard({ health, error }) {
  return (
    <>
      {error ? <p className="text-danger">{error}</p> : null}
      <div className="rg-stat-row">
        <article className="rg-stat">
          <span className="rg-risk-bar rg-risk-low" />
          <div>
            <p className="small text-muted mb-0">Trạm IoT online / offline</p>
            <strong>{health ? `${METRIC_DASH} / ${METRIC_DASH}` : '…'}</strong>
          </div>
        </article>
        <article className="rg-stat rg-stat-spark">
          <span className="rg-risk-bar rg-risk-low" />
          <div>
            <p className="small text-muted mb-0">Thời gian phản hồi API</p>
            <strong>{health ? METRIC_DASH : '…'}</strong>
            <RgSparkline points={health?.latencySeries || []} label="Latency theo giờ" />
          </div>
        </article>
        <article className="rg-stat rg-stat-spark">
          <span className="rg-risk-bar rg-risk-low" />
          <div>
            <p className="small text-muted mb-0">Tỷ lệ lỗi hệ thống</p>
            <strong>{health ? METRIC_DASH : '…'}</strong>
            <RgSparkline
              points={health?.uptimeSeries || []}
              label="Uptime theo giờ"
              color="var(--rg-primary)"
            />
          </div>
        </article>
      </div>
      <p className="small text-muted mb-2">
        Đồng bộ App 24h: {health ? METRIC_DASH : '…'} · Poll 10 giây ·{' '}
        {health ? formatWhen(health.sampledAt) : ''} · chưa dùng WebSocket
      </p>
      <h2 className="h6 mb-2">Lỗi gần đây</h2>
      <ul className="rg-log-list">
        {(health?.recentIncidents || []).map((row) => (
          <li key={row.id} className="rg-log-row">
            <span>{formatWhen(row.at)}</span>
            <span className={`rg-log-level rg-log-level--${row.level}`}>{row.level}</span>
            <span>{row.message}</span>
          </li>
        ))}
        {!health?.recentIncidents?.length ? <li className="text-muted">—</li> : null}
      </ul>
    </>
  )
}
