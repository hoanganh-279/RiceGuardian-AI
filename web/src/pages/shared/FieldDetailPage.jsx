import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FieldCoverAnnotator } from '../../components/fields/FieldCoverAnnotator.jsx'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { RgModal } from '../../components/layout/RgModal.jsx'
import { StationFormModal } from '../../components/stations/StationFormModal.jsx'
import { FEATURES } from '../../constants/features.js'
import { stationManagePath, stationSensorsPath } from '../../constants/sensors.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'
import { METRIC_DASH } from '../../utils/metricDisplay.js'

const COVER_SOURCE_LABEL = {
  upload: 'Ảnh upload từ máy',
  uav: 'Ảnh UAV',
  none: 'Chưa có ảnh',
}

const BLB_LEGEND = [
  { label: 'Bệnh nhẹ', color: '#ffff00' },
  { label: 'Bệnh nặng', color: '#ff0000' },
]
const COVER_ACCEPT = 'image/*,.tif,.tiff'
const UAV_MS_ACCEPT = '.tif,.tiff'

function formatPct(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return METRIC_DASH
  const num = Number(value)
  return `${num.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`
}

export default function FieldDetailPage() {
  const { fieldId } = useParams()
  const { user, isManager } = useAuth()
  const fileRef = useRef(null)
  const uavFileRef = useRef(null)
  const canManage = !isManager
  const backPath = isManager ? '/manager/map' : '/technician/map'

  const [field, setField] = useState(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [stationForm, setStationForm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [warning, setWarning] = useState('')

  async function load() {
    const row = await api.getField(fieldId)
    setField(row)
    return row
  }

  useEffect(() => {
    let alive = true
    setError('')
    load().catch((err) => {
      if (alive) setError(err.message)
    })
    return () => {
      alive = false
    }
  }, [fieldId])

  function applyCoverResult(next, fileName, source) {
    setField(next)
    if (next.blbWarning) {
      setWarning(next.blbWarning)
      setStatus(
        source === 'uav'
          ? `Đã gắn ảnh UAV ${fileName}. Chưa phân tích được.`
          : `Đã lưu ảnh ${fileName}. Chưa phân tích được.`,
      )
      return
    }
    setWarning('')
    const pct = formatPct(next.blbDiseasePct)
    setStatus(
      pct
        ? `Đã phân tích ${fileName} — ${pct} diện tích bệnh (BLB).`
        : `Đã phân tích ${fileName}.`,
    )
  }

  async function onPickCover(event, source = 'upload') {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setWarning('')
    setStatus('Đang phân tích…')
    setAnalyzing(true)
    try {
      const next = await api.uploadFieldCover(fieldId, file, source)
      applyCoverResult(next, file.name, source)
    } catch (err) {
      setError(err.message)
      setStatus('')
    } finally {
      setAnalyzing(false)
    }
  }

  async function onRerunBlb() {
    setError('')
    setWarning('')
    setStatus('Đang chạy lại phân tích BLB…')
    setAnalyzing(true)
    try {
      const next = await api.rerunFieldBlbSegment(fieldId)
      setField(next)
      const pct = formatPct(next.blbDiseasePct)
      setWarning('')
      setStatus(pct ? `Đã phân tích lại — ${pct} diện tích bệnh (BLB).` : 'Đã chạy lại phân tích BLB.')
    } catch (err) {
      setError(err.message)
      setStatus('')
    } finally {
      setAnalyzing(false)
    }
  }

  async function confirmDeleteStation() {
    if (!field?.station) return
    await api.deleteStation(field.station.id)
    setDeleting(false)
    setStatus('Đã gỡ trạm khỏi thửa.')
    await load()
  }

  const station = field?.station
  const farmers = field?.farmers || []
  const diseasePct = formatPct(field?.blbDiseasePct)
  const lowPct = formatPct(field?.blbStats?.lowSeverityPct)
  const highPct = formatPct(field?.blbStats?.highSeverityPct)
  const healthyPct = formatPct(field?.blbStats?.healthyPct)

  return (
    <PageFrame
      code="D2"
      title={field ? field.name : 'Chi tiết thửa'}
      description={
        field
          ? `${field.orgName} · ${METRIC_DASH} · ${field.variety}`
          : FEATURES.D2.description
      }
      actions={
        <Link className="btn btn-rg-ghost" to={backPath}>
          Về lưới thửa
        </Link>
      }
    >
      {error ? <p className="text-danger">{error}</p> : null}
      {warning ? <p className="text-warning">{warning}</p> : null}
      {status ? <p className="text-success">{status}</p> : null}
      {!field ? null : (
        <>
          <div className="rg-field-cover-hero mb-3">
            {field.coverUrl ? (
              <FieldCoverAnnotator
                src={field.coverUrl}
                alt={`Ảnh bìa ${field.name}`}
                outline={field.coverOutline}
                maskUrl={field.blbMaskUrl}
                canEdit={canManage}
                onCrop={async (blob, rect) => {
                  setWarning('')
                  const next = await api.cropFieldCover(fieldId, blob, rect)
                  setField(next)
                  setWarning(next.blbWarning || '')
                  setStatus('Đã cắt ảnh. Vẽ ranh giới thửa rồi lưu để phân tích bệnh trong vùng đã vẽ.')
                }}
                onSaveOutline={async (points) => {
                  setWarning('')
                  const next = await api.saveFieldCoverOutline(fieldId, points)
                  setField(next)
                  if (next.blbWarning) {
                    setWarning(next.blbWarning)
                    setStatus('Đã lưu ranh giới. Chưa phân tích được.')
                    return
                  }
                  const pct = formatPct(next.blbDiseasePct)
                  setStatus(
                    pct
                      ? `Đã phân tích trong ranh giới — ${pct} diện tích bệnh (BLB).`
                      : 'Đã lưu ranh giới và phân tích BLB.',
                  )
                }}
              />
            ) : (
              <div className="rg-field-tile-placeholder">Chưa có ảnh UAV hoặc ảnh upload</div>
            )}
          </div>
          <p className="rg-meta mb-2">
            <span>{COVER_SOURCE_LABEL[field.coverSource] || COVER_SOURCE_LABEL.none}</span>
            {field.coverFileName ? <span>{field.coverFileName}</span> : null}
          </p>
          {diseasePct || field.coverMsFileName ? (
            <div className="rg-blb-summary mb-3">
              {diseasePct ? (
                <span className="rg-blb-badge">BLB {diseasePct}</span>
              ) : null}
              {lowPct ? <span className="rg-meta">Bệnh nhẹ {lowPct}</span> : null}
              {highPct ? <span className="rg-meta">Bệnh nặng {highPct}</span> : null}
              {field.blbStats?.healthyPct != null ? (
                <span className="rg-meta">Lúa khỏe {healthyPct}</span>
              ) : null}
              {field.coverMsFileName ? <span className="rg-meta">MS: {field.coverMsFileName}</span> : null}
              {field.blbInferredAt ? (
                <span className="rg-meta">
                  Phân tích: {new Date(field.blbInferredAt).toLocaleString('vi-VN')}
                </span>
              ) : null}
            </div>
          ) : null}
          {field.blbMaskUrl ? (
            <>
              <ul className="rg-blb-legend list-unstyled mb-3">
                {BLB_LEGEND.map((item) => (
                  <li key={item.label}>
                    <span className="rg-blb-swatch" style={{ background: item.color }} />
                    {item.label}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {canManage ? (
            <div className="mb-4 d-flex flex-wrap gap-2 align-items-center">
              <input
                ref={fileRef}
                type="file"
                accept={COVER_ACCEPT}
                className="d-none"
                disabled={analyzing}
                onChange={(event) => onPickCover(event, 'upload')}
              />
              <input
                ref={uavFileRef}
                type="file"
                accept={UAV_MS_ACCEPT}
                className="d-none"
                disabled={analyzing}
                onChange={(event) => onPickCover(event, 'uav')}
              />
              <button
                type="button"
                className="btn btn-rg-ghost"
                disabled={analyzing}
                onClick={() => fileRef.current?.click()}
              >
                {analyzing ? 'Đang phân tích…' : 'Upload ảnh từ thư mục'}
              </button>
              <button
                type="button"
                className="btn btn-rg"
                disabled={analyzing}
                onClick={() => uavFileRef.current?.click()}
              >
                {analyzing ? 'Đang phân tích…' : 'Liên kết ảnh UAV đa phổ (TIFF 6 kênh)'}
              </button>
              {field.coverMsUrl ? (
                <button type="button" className="btn btn-rg-ghost" disabled={analyzing} onClick={onRerunBlb}>
                  Chạy lại phân tích BLB
                </button>
              ) : null}
            </div>
          ) : null}

          <h2 className="h5">Nông dân đứng tên</h2>
          {farmers.length ? (
            <ul className="list-unstyled mb-4">
              {farmers.map((farmer) => (
                <li key={farmer.id} className="mb-2">
                  <strong>{farmer.fullName}</strong>
                  <div className="rg-meta">
                    <span>{farmer.phone}</span>
                    <span>{farmer.appAccount ? 'Tài khoản App' : 'Chưa cấp App'}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted mb-4">Chưa gắn hộ nông dân.</p>
          )}

          <h2 className="h5">Trạm IoT tại thửa</h2>
          {station ? (
            <article className="rg-station-card mb-3">
              <span className={`rg-risk-bar ${station.issue ? 'rg-risk-medium' : station.online ? 'rg-risk-low' : 'rg-risk-high'}`} />
              <div className="rg-station-card-body">
                <h3 className="h6 mb-1">{station.code}</h3>
                <p className="small text-muted mb-1">{station.name}</p>
                <div className="rg-meta mb-2">
                  <span>{station.online ? 'Online' : 'Offline'}</span>
                  <span>Pin {station.batteryPct ?? '—'}%</span>
                </div>
                {station.issue ? <p className="small text-danger">{station.issue}</p> : null}
                {canManage ? (
                  <div className="d-flex flex-wrap gap-2">
                    <Link className="btn btn-sm btn-rg" to={stationSensorsPath(user.role, station.id)}>
                      Cảm biến
                    </Link>
                    <Link className="btn btn-sm btn-rg-ghost" to={stationManagePath(user.role, station.id)}>
                      Quản lý
                    </Link>
                    <button type="button" className="btn btn-sm btn-light" onClick={() => setStationForm('edit')}>
                      Sửa trạm
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleting(true)}>
                      Gỡ trạm
                    </button>
                  </div>
                ) : (
                  <p className="small text-muted mb-0">Quản lý HTX chỉ xem trạm. KTV/Admin thao tác từ lưới canh tác.</p>
                )}
              </div>
            </article>
          ) : (
            <div className="mb-3">
              <p className="text-muted">Chưa gán trạm IoT cho thửa này.</p>
              {canManage ? (
                <button type="button" className="btn btn-rg" onClick={() => setStationForm('create')}>
                  Thêm trạm tại thửa
                </button>
              ) : null}
            </div>
          )}
        </>
      )}

      {stationForm ? (
        <StationFormModal
          title={stationForm === 'create' ? 'Thêm trạm quan trắc' : 'Sửa trạm'}
          fields={field ? [field] : []}
          lockField
          initial={
            stationForm === 'edit' && station
              ? station
              : { fieldId: field?.id }
          }
          onClose={() => setStationForm(null)}
          onSubmit={async (payload) => {
            if (stationForm === 'create') {
              await api.createStation({ ...payload, fieldId: field.id })
              setStatus('Đã thêm trạm cho thửa.')
            } else {
              await api.updateStation(station.id, { ...payload, fieldId: field.id })
              setStatus('Đã cập nhật trạm.')
            }
            setStationForm(null)
            await load()
          }}
        />
      ) : null}

      {deleting ? (
        <RgModal title="Gỡ trạm khỏi thửa?" onClose={() => setDeleting(false)}>
          <p>Xóa trạm {station?.code} và dữ liệu cảm biến mock gắn với trạm.</p>
          <div className="d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-light" onClick={() => setDeleting(false)}>
              Hủy
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmDeleteStation}>
              Xóa trạm
            </button>
          </div>
        </RgModal>
      ) : null}
    </PageFrame>
  )
}
