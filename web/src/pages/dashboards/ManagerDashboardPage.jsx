import { useEffect, useState } from 'react'
import { RgDonutChart } from '../../components/charts/RgDonutChart.jsx'
import { RgLineChart } from '../../components/charts/RgLineChart.jsx'
import { RgRankBars } from '../../components/charts/RgRankBars.jsx'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FEATURES } from '../../constants/features.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'
import { METRIC_DASH } from '../../utils/metricDisplay.js'

export default function ManagerDashboardPage() {
  const { selectedOrgIds, organizations } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api
      .getManagerDashboard(selectedOrgIds)
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
      : organizations[0]?.name || 'Đơn vị của bạn'

  return (
    <PageFrame
      code="C1"
      title={FEATURES.C1.title}
      description={`${orgNote}. ${FEATURES.C1.description}`}
    >
      {error ? <p className="text-danger">{error}</p> : null}
      <div className="rg-stat-row rg-stat-row--4">
        <article className="rg-stat">
          <span className="rg-risk-bar rg-risk-low" />
          <div>
            <p className="small text-muted mb-0">Tổng diện tích</p>
            <strong>{data ? METRIC_DASH : '…'}</strong>
          </div>
        </article>
        <article className="rg-stat">
          <span className="rg-risk-bar rg-risk-medium" />
          <div>
            <p className="small text-muted mb-0">Thửa đang cảnh báo</p>
            <strong>
              {data ? `${METRIC_DASH} / ${METRIC_DASH}` : '…'}
            </strong>
          </div>
        </article>
        <article className="rg-stat">
          <span className="rg-risk-bar rg-risk-low" />
          <div>
            <p className="small text-muted mb-0">KTV hoạt động</p>
            <strong>{data ? METRIC_DASH : '…'}</strong>
          </div>
        </article>
        <article className="rg-stat">
          <span className="rg-risk-bar rg-risk-high" />
          <div>
            <p className="small text-muted mb-0">Tỷ lệ cảnh báo đúng</p>
            <strong>{data ? METRIC_DASH : '…'}</strong>
          </div>
        </article>
      </div>

      <div className="rg-dash-grid">
        <RgLineChart points={data?.trend || []} label="Số lượng cảnh báo theo ngày" />
        <RgDonutChart byRisk={data?.byRisk} label="Phân bố cảnh báo theo mức độ" />
      </div>

      <RgRankBars items={data?.topFields || []} />
    </PageFrame>
  )
}
