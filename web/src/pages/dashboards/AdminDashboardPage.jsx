import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RgDonutChart } from '../../components/charts/RgDonutChart.jsx'
import { RgLineChart } from '../../components/charts/RgLineChart.jsx'
import { RgRankBars } from '../../components/charts/RgRankBars.jsx'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { StatusPill } from '../../components/workspace/StatusPill.jsx'
import { formatWhen } from '../../components/workspace/format.js'
import { FEATURES } from '../../constants/features.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'
import { METRIC_DASH } from '../../utils/metricDisplay.js'

const UAV_STATUS_LABEL = {
  queued: 'Chờ xử lý',
  processing: 'Đang ghép ảnh',
  done: 'Xong',
}

const UAV_STATUS_TONE = {
  queued: 'muted',
  processing: 'warning',
  done: 'success',
}

export default function AdminDashboardPage() {
  const { selectedOrgIds, organizations } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api
      .getAdminDashboard(selectedOrgIds)
      .then((result) => {
        if (alive) setData(result)
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [selectedOrgIds])

  const orgNote =
    selectedOrgIds.length === 1
      ? organizations.find((org) => org.id === selectedOrgIds[0])?.name
      : 'toàn hệ thống'

  return (
    <PageFrame
      code="B0"
      title={FEATURES.B0.title}
      description={`Đang xem ${orgNote}. ${FEATURES.B0.description}`}
    >
      {error ? <p className="text-danger">{error}</p> : null}

      <div className="rg-stat-row rg-stat-row--3">
        <Link to="/technician/alerts?type=image" className="text-decoration-none text-reset">
          <article className="rg-stat">
            <span className="rg-risk-bar rg-risk-high" />
            <div>
              <p className="small text-muted mb-0">Cảnh báo bệnh chưa xử lý</p>
              <strong>{data ? METRIC_DASH : '…'}</strong>
            </div>
          </article>
        </Link>
        <Link to="/admin/devices" className="text-decoration-none text-reset">
          <article className="rg-stat">
            <span className="rg-risk-bar rg-risk-medium" />
            <div>
              <p className="small text-muted mb-0">Trạm IoT offline</p>
              <strong>
                {data ? `${METRIC_DASH} / ${METRIC_DASH}` : '…'}
              </strong>
            </div>
          </article>
        </Link>
        <Link to="/technician/uav" className="text-decoration-none text-reset">
          <article className="rg-stat">
            <span className="rg-risk-bar rg-risk-low" />
            <div>
              <p className="small text-muted mb-0">Đợt UAV</p>
              <strong>{data ? METRIC_DASH : '…'}</strong>
            </div>
          </article>
        </Link>
      </div>

      <div className="rg-dash-grid">
        <RgLineChart
          points={data?.uavTrend || []}
          label="Số đợt UAV theo ngày (7 ngày)"
          color="var(--rg-primary)"
        />
        <RgDonutChart
          byRisk={data?.iotStatus || { high: 0, medium: 0, low: 0 }}
          label="Trạm IoT: offline (đỏ) / online (xanh)"
        />
      </div>

      <div className="rg-dash-grid mt-3">
        <RgRankBars items={data?.uavByRegion || []} label="Đợt UAV theo vùng" />
        <RgRankBars items={data?.iotOfflineByRegion || []} label="Trạm IoT offline theo vùng" />
      </div>

      <section className="mt-4">
        <div className="rg-uav-recent-head">
          <h2>Đợt UAV gần đây</h2>
          <Link className="rg-uav-recent-all" to="/technician/uav">
            Xem tất cả →
          </Link>
        </div>
        {!data ? (
          <p className="text-muted">Đang tải…</p>
        ) : data.recentSurveys.length === 0 ? (
          <p className="text-muted">Chưa có đợt khảo sát.</p>
        ) : (
          <ul className="rg-uav-recent-list">
            {data.recentSurveys.map((survey) => (
              <li key={survey.id}>
                <Link className="rg-uav-recent-card" to={`/technician/uav?survey=${survey.id}`}>
                  <div className="rg-uav-recent-top">
                    <div>
                      <p className="rg-uav-recent-title">{survey.name}</p>
                      <p className="rg-uav-recent-org mb-0">{survey.orgName || 'Vùng'}</p>
                    </div>
                    <StatusPill tone={UAV_STATUS_TONE[survey.status] || 'muted'}>
                      {UAV_STATUS_LABEL[survey.status] || survey.status}
                    </StatusPill>
                  </div>
                  <div className="rg-uav-recent-metrics">
                    <div>
                      <span className="rg-uav-recent-metric-label">Diện tích</span>
                      <span className="rg-uav-recent-metric-value">{survey.coverageHa} ha</span>
                    </div>
                    <div>
                      <span className="rg-uav-recent-metric-label">Bay lúc</span>
                      <span className="rg-uav-recent-metric-value">{formatWhen(survey.flownAt)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageFrame>
  )
}
