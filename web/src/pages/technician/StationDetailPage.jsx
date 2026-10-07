import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { RgModal } from '../../components/layout/RgModal.jsx'
import { SensorReadingsTable } from '../../components/stations/SensorReadingsTable.jsx'
import { StationFormModal } from '../../components/stations/StationFormModal.jsx'
import { FEATURES } from '../../constants/features.js'
import { SENSOR_METRICS, formatMetricValue } from '../../constants/sensors.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'

function formatWhen(iso) {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function exportReportCsv(report) {
  const lines = [['Chi so', 'Min', 'Max', 'TB']]
  SENSOR_METRICS.forEach((metric) => {
    const stat = report.stats[metric.key] || {}
    lines.push([metric.label, stat.min ?? '', stat.max ?? '', stat.avg ?? ''])
  })
  lines.push([])
  lines.push(['So mau', report.sampleCount])
  lines.push(['Vuot nguong', report.breachCount])
  lines.push(['Online %', report.onlinePct])
  const blob = new Blob([lines.map((row) => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${report.station.code}-bao-cao.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function StationDetailPage() {
  const { stationId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin } = useAuth()
  const deviceAdminView = location.pathname.startsWith('/admin/devices')
  const feature = deviceAdminView ? FEATURES.B3 : FEATURES.D9
  const tab = deviceAdminView && searchParams.get('tab') === 'sensors' ? 'sensors' : 'manage'

  const [station, setStation] = useState(null)
  const [report, setReport] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [readings, setReadings] = useState({ items: [], thresholds: null })
  const [fields, setFields] = useState([])
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [maintaining, setMaintaining] = useState(false)
  const [maintainNote, setMaintainNote] = useState('')
  const [alertForm, setAlertForm] = useState({ title: '', body: '', kind: 'fault' })
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const listPath = deviceAdminView
    ? '/admin/devices'
    : station?.fieldId
      ? `/technician/fields/${station.fieldId}`
      : '/technician/map'

  const items = useMemo(
    () => readings.items.filter((row) => row.stationId === stationId),
    [readings.items, stationId],
  )

  async function load() {
    const [detail, reportRow, alertRows, fieldRows, sensorPayload] = await Promise.all([
      api.getStation(stationId),
      api.getStationReport(stationId),
      api.getStationAlerts(stationId),
      api.getAssignedFields(),
      api.getSensorReadings({ stationId }),
    ])
    setStation(detail)
    setReport(reportRow)
    setAlerts(alertRows)
    setFields(fieldRows)
    setReadings(sensorPayload)
  }

  useEffect(() => {
    let alive = true
    setError('')
    Promise.all([
      api.getStation(stationId),
      api.getStationReport(stationId),
      api.getStationAlerts(stationId),
      api.getAssignedFields(),
      api.getSensorReadings({ stationId }),
    ])
      .then(([detail, reportRow, alertRows, fieldRows, sensorPayload]) => {
        if (!alive) return
        setStation(detail)
        setReport(reportRow)
        setAlerts(alertRows)
        setFields(fieldRows)
        setReadings(sensorPayload)
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [stationId, isAdmin])

  async function submitAlert(event) {
    event.preventDefault()
    await api.createStationAlert(stationId, alertForm)
    setAlertForm({ title: '', body: '', kind: 'fault' })
    setStatus('Đã gửi cảnh báo tới thông báo web và bản ghi App nông dân.')
    await load()
  }

  async function confirmDelete() {
    await api.deleteStation(stationId)
    navigate(listPath, { replace: true })
  }

  return (
    <PageFrame
      code={feature.code}
      title={station ? `${station.code} — ${station.name || 'Trạm quan trắc'}` : 'Chi tiết trạm'}
      description={station ? `${station.orgName || ''} · ${station.fieldName || 'Chưa gán thửa'}` : feature.description}
      actions={
        <div className="d-flex flex-wrap gap-2">
          <Link className="btn btn-rg-ghost" to={listPath}>
            {deviceAdminView ? 'Về danh sách' : 'Về thửa ruộng'}
          </Link>
          {station ? (
            <>
              <button type="button" className="btn btn-outline-secondary" onClick={() => setEditing(true)}>
                Sửa
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => setMaintaining(true)}>
                Bảo trì
              </button>
              <button type="button" className="btn btn-outline-danger" onClick={() => setDeleting(true)}>
                Xóa
              </button>
            </>
          ) : null}
        </div>
      }
    >
      {error ? <p className="text-danger">{error}</p> : null}
      {status ? <p className="text-success">{status}</p> : null}

      {deviceAdminView ? (
        <div className="rg-filter-row mb-3">
          <button
            type="button"
            className={`rg-pill${tab === 'manage' ? ' active' : ''}`}
            onClick={() => setSearchParams({})}
          >
            Quản lý
          </button>
          <button
            type="button"
            className={`rg-pill${tab === 'sensors' ? ' active' : ''}`}
            onClick={() => setSearchParams({ tab: 'sensors' })}
          >
            Cảm biến
          </button>
        </div>
      ) : null}

      {station ? (
        <div className="rg-meta mb-3">
          <span>{station.online ? 'Online' : 'Offline'}</span>
          <span>Pin {station.batteryPct ?? '—'}%</span>
          <span>Cập nhật {formatWhen(station.lastSeenAt)}</span>
          {station.lat != null && station.lng != null ? (
            <span>
              {station.lat}, {station.lng}
            </span>
          ) : null}
          {station.issue ? <span className="text-danger">{station.issue}</span> : null}
        </div>
      ) : null}

      {tab === 'sensors' ? (
        <SensorReadingsTable key={stationId} items={items} thresholds={readings.thresholds} />
      ) : (
        <>
          {report ? (
            <section className="mb-4">
              <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-2">
                <h2 className="h5 mb-0">Báo cáo 24 giờ</h2>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => exportReportCsv(report)}>
                  Xuất CSV
                </button>
              </div>
              <p className="small text-muted">
                {report.sampleCount} mẫu · {report.breachCount} lần vượt ngưỡng · online {report.onlinePct}%
              </p>
              <div className="table-responsive">
                <table className="rg-table">
                  <thead>
                    <tr>
                      <th>Chỉ số</th>
                      <th>Min</th>
                      <th>Max</th>
                      <th>Trung bình</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SENSOR_METRICS.map((metric) => {
                      const stat = report.stats[metric.key] || {}
                      return (
                        <tr key={metric.key}>
                          <td>{metric.label}</td>
                          <td>{formatMetricValue(metric.key, stat.min)}</td>
                          <td>{formatMetricValue(metric.key, stat.max)}</td>
                          <td>{formatMetricValue(metric.key, stat.avg)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="h5">Cảnh báo trạm</h2>
            {alerts.map((item) => (
              <article key={item.id} className="rg-field-row">
                <span className={`rg-risk-bar ${item.kind === 'fault' ? 'rg-risk-high' : 'rg-risk-medium'}`} />
                <div>
                  <strong>{item.title}</strong>
                  <p className="mb-1 text-muted">{item.body}</p>
                  <div className="rg-meta">
                    <span>{formatWhen(item.createdAt)}</span>
                    <span>{item.kind === 'fault' ? 'Trạm hư' : 'Vượt ngưỡng'}</span>
                  </div>
                </div>
              </article>
            ))}
            <form className="mt-3" style={{ maxWidth: '28rem' }} onSubmit={submitAlert}>
              <label className="form-label" htmlFor="sta-kind">
                Loại
              </label>
              <select
                id="sta-kind"
                className="form-select mb-2"
                value={alertForm.kind}
                onChange={(event) => setAlertForm({ ...alertForm, kind: event.target.value })}
              >
                <option value="fault">Trạm hư</option>
                <option value="threshold">Vượt ngưỡng</option>
              </select>
              <label className="form-label" htmlFor="sta-title">
                Tiêu đề
              </label>
              <input
                id="sta-title"
                className="form-control mb-2"
                required
                value={alertForm.title}
                onChange={(event) => setAlertForm({ ...alertForm, title: event.target.value })}
              />
              <label className="form-label" htmlFor="sta-body">
                Nội dung (gửi web + App nông dân)
              </label>
              <textarea
                id="sta-body"
                className="form-control mb-3"
                rows="3"
                value={alertForm.body}
                onChange={(event) => setAlertForm({ ...alertForm, body: event.target.value })}
              />
              <button type="submit" className="btn btn-rg">
                Tạo cảnh báo
              </button>
            </form>
          </section>
        </>
      )}

      {editing && station ? (
        <StationFormModal
          title={`Sửa ${station.code}`}
          fields={fields}
          initial={station}
          allowUnassigned={isAdmin}
          onClose={() => setEditing(false)}
          onSubmit={async (payload) => {
            if (isAdmin) {
              if (!payload.fieldId) await api.revokeDevice(station.id)
              else await api.assignDevice(station.id, payload.fieldId)
              await api.updateStation(station.id, {
                code: payload.code,
                name: payload.name,
                lat: payload.lat,
                lng: payload.lng,
              })
            } else {
              await api.updateStation(station.id, payload)
            }
            setEditing(false)
            await load()
          }}
        />
      ) : null}

      {maintaining && station ? (
        <RgModal title={`Yêu cầu bảo trì ${station.code}`} onClose={() => setMaintaining(false)}>
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              await api.requestStationMaintenance(station.id, maintainNote)
              setMaintaining(false)
              setMaintainNote('')
              setStatus('Đã gửi yêu cầu bảo trì.')
              await load()
            }}
          >
            <label className="form-label" htmlFor="st-maint">
              Ghi chú sự cố
            </label>
            <textarea
              id="st-maint"
              className="form-control mb-3"
              rows="3"
              value={maintainNote}
              onChange={(event) => setMaintainNote(event.target.value)}
              placeholder="Pin thấp, lệch vị trí, mất kết nối…"
            />
            <div className="d-flex gap-2 justify-content-end">
              <button type="button" className="btn btn-light" onClick={() => setMaintaining(false)}>
                Hủy
              </button>
              <button type="submit" className="btn btn-rg">
                Gửi yêu cầu
              </button>
            </div>
          </form>
        </RgModal>
      ) : null}

      {deleting && station ? (
        <RgModal title={`Xóa ${station.code}?`} onClose={() => setDeleting(false)}>
          <p>Thao tác này gỡ trạm khỏi danh sách phiên hiện tại. Dữ liệu cảm biến mock của trạm cũng bị xóa.</p>
          <div className="d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-light" onClick={() => setDeleting(false)}>
              Hủy
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmDelete}>
              Xóa trạm
            </button>
          </div>
        </RgModal>
      ) : null}
    </PageFrame>
  )
}
