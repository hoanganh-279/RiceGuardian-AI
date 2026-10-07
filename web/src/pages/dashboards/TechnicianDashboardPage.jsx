import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FieldBoard } from '../../components/fields/FieldTile.jsx'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { ALERT_TYPE_LABEL, RISK_LABEL } from '../../constants/alerts.js'
import { fieldDetailPath } from '../../constants/fields.js'
import { FEATURES } from '../../constants/features.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'
import { METRIC_DASH } from '../../utils/metricDisplay.js'

function formatWhen(iso) {
  return new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export default function TechnicianDashboardPage() {
  const { selectedOrgIds, organizations, isAdmin, user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api
      .getTechnicianDashboard(selectedOrgIds)
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

  const orgNote = isAdmin
    ? 'toàn hệ thống'
    : selectedOrgIds.length === 1
      ? organizations.find((org) => org.id === selectedOrgIds[0])?.name
      : `${organizations.length} đơn vị được phân công`
  const fields = data?.fields || []
  const mapFeatures = data?.mapFeatures || []
  const todayInspections = data?.todayInspections || []

  return (
    <PageFrame
      code="D1"
      title={isAdmin ? 'Dashboard' : FEATURES.D1.title}
      description={
        isAdmin
          ? `Đang xem ${orgNote}. Cảnh báo, lịch kiểm tra và thửa ưu tiên trên toàn hệ thống.`
          : `Đang xem ${orgNote}. ${FEATURES.D1.description}`
      }
    >
      {error ? <p className="text-danger">{error}</p> : null}

      <div className="rg-stat-row rg-stat-row--2">
        <Link to="/technician/alerts" className="text-decoration-none text-reset">
          <article className="rg-stat">
            <span className="rg-risk-bar rg-risk-high" />
            <div>
              <p className="small text-muted mb-0">Cảnh báo chưa xử lý hôm nay</p>
              <strong>{data ? METRIC_DASH : '…'}</strong>
            </div>
          </article>
        </Link>
        <Link to="/technician/inspections" className="text-decoration-none text-reset">
          <article className="rg-stat">
            <span className="rg-risk-bar rg-risk-medium" />
            <div>
              <p className="small text-muted mb-0">Lịch kiểm tra hôm nay</p>
              <strong>{data ? METRIC_DASH : '…'}</strong>
            </div>
          </article>
        </Link>
      </div>

      <div className="d-flex justify-content-between align-items-baseline mb-2">
        <h2 className="h5 mb-0">Bản đồ ưu tiên</h2>
        <Link to="/technician/map" className="small text-decoration-none">
          Bản đồ đầy đủ
        </Link>
      </div>
      <div className="rg-map-compact mb-4">
        <FieldBoard
          fields={mapFeatures}
          compact
          showOrg
          hrefFor={(field) => fieldDetailPath(user.role, field.id)}
        />
      </div>

      {todayInspections.length ? (
        <>
          <h2 className="h5 mb-2">Lịch hôm nay</h2>
          {todayInspections.map((row) => (
            <article key={row.id} className="rg-field-row">
              <span className="rg-risk-bar rg-risk-medium" />
              <div>
                <span className="rg-org-label">{row.orgName}</span>
                <h2 className="h6 mb-1">{row.fieldName}</h2>
                <div className="rg-meta">
                  <span>{formatWhen(row.scheduledAt)}</span>
                  <span>{row.note}</span>
                </div>
              </div>
            </article>
          ))}
        </>
      ) : null}

      <div className="d-flex justify-content-between align-items-baseline mb-2 mt-3">
        <h2 className="h5 mb-0">Thửa theo mức nguy cơ</h2>
        <Link to="/technician/alerts" className="small text-decoration-none">
          Xem cảnh báo
        </Link>
      </div>

      {fields.map((field) => (
        <article key={field.id} className="rg-field-row">
          <span className={`rg-risk-bar rg-risk-${field.riskLevel}`} />
          <div>
            <span className="rg-org-label">{field.orgName}</span>
            <h2 className="h5 mb-1">{field.name}</h2>
            <div className="rg-meta">
              <span>
                {METRIC_DASH} · {field.variety}
              </span>
              <span>{ALERT_TYPE_LABEL[field.riskType]}</span>
            </div>
          </div>
          <div className="text-end">
            <strong className="d-block">{RISK_LABEL[field.riskLevel]}</strong>
            <Link to="/technician/alerts" className="small text-decoration-none">
              Xem cảnh báo
            </Link>
          </div>
        </article>
      ))}
    </PageFrame>
  )
}
