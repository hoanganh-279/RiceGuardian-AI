import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { parseOutlinePoints } from './FieldCoverAnnotator.jsx'

function Cover({ field, compact }) {
  const outline = parseOutlinePoints(field.coverOutline?.points)
  const diseasePct =
    field.blbDiseasePct != null && !Number.isNaN(Number(field.blbDiseasePct))
      ? `${Number(field.blbDiseasePct).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`
      : null
  if (field.coverUrl) {
    return (
      <>
        <img
          className="rg-field-tile-img"
          src={field.blbMaskUrl || field.coverUrl}
          alt=""
          loading="lazy"
          width={compact ? 320 : 640}
          height={compact ? 180 : 360}
        />
        {outline.length >= 3 ? (
          <svg className="rg-field-tile-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polygon points={outline.map((point) => `${point.x},${point.y}`).join(' ')} />
          </svg>
        ) : null}
        {diseasePct ? <span className="rg-field-tile-blb">BLB {diseasePct}</span> : null}
      </>
    )
  }
  return (
    <div className="rg-field-tile-placeholder" aria-hidden="true">
      Chưa có ảnh UAV / upload
    </div>
  )
}

function CoverActions({ field, uploading, onCoverUpload }) {
  const uploadRef = useRef(null)
  const uavRef = useRef(null)

  function stopNav(event) {
    event.preventDefault()
    event.stopPropagation()
  }

  async function pick(event, source) {
    stopNav(event)
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !onCoverUpload) return
    await onCoverUpload(field, file, source)
  }

  return (
    <div className="rg-field-tile-actions" onClick={stopNav} onKeyDown={stopNav}>
      <input
        ref={uploadRef}
        type="file"
        accept="image/*,.tif,.tiff"
        className="d-none"
        disabled={uploading}
        onChange={(event) => pick(event, 'upload')}
      />
      <input
        ref={uavRef}
        type="file"
        accept=".tif,.tiff"
        className="d-none"
        disabled={uploading}
        onChange={(event) => pick(event, 'uav')}
      />
      <button
        type="button"
        className="btn btn-sm btn-rg-ghost rg-field-tile-action"
        disabled={uploading}
        onClick={(event) => {
          stopNav(event)
          uploadRef.current?.click()
        }}
      >
        Upload ảnh
      </button>
      <button
        type="button"
        className="btn btn-sm btn-rg rg-field-tile-action"
        disabled={uploading}
        onClick={(event) => {
          stopNav(event)
          uavRef.current?.click()
        }}
      >
        Liên kết UAV đa phổ
      </button>
      {uploading ? <span className="rg-field-tile-uploading">Đang phân tích…</span> : null}
    </div>
  )
}

export function FieldTile({
  field,
  href,
  showOrg = false,
  compact = false,
  canManageCover = false,
  uploading = false,
  onCoverUpload,
}) {
  const station = field.station
  const stationLabel = station
    ? `${station.code} · ${station.online ? 'Online' : 'Offline'}`
    : 'Chưa gán trạm'
  const coverHint = field.coverSource === 'upload' ? 'Ảnh upload' : field.coverSource === 'uav' ? 'UAV' : 'Không ảnh'

  const inner = (
    <>
      <span className={`rg-field-tile-risk rg-risk-${field.riskLevel}`} />
      <div className="rg-field-tile-media">
        <Cover field={field} compact={compact} />
        <span className="rg-field-tile-chip">{coverHint}</span>
        {canManageCover ? (
          <CoverActions field={field} uploading={uploading} onCoverUpload={onCoverUpload} />
        ) : null}
      </div>
      <div className="rg-field-tile-body">
        {showOrg && field.orgName ? <span className="rg-org-label">{field.orgName}</span> : null}
        <h2 className={compact ? 'h6 mb-1' : 'h5 mb-1'}>{field.name}</h2>
        <p className="small mb-1">{field.farmerLabel}</p>
        <div className="rg-meta">
          <span>{stationLabel}</span>
          {station?.issue ? <span className="text-danger">{station.issue}</span> : null}
        </div>
      </div>
    </>
  )

  const className = `rg-field-tile rg-field-tile--${field.riskLevel}${compact ? ' rg-field-tile--compact' : ''}${
    uploading ? ' rg-field-tile--uploading' : ''
  }`

  if (!href) {
    return <article className={className}>{inner}</article>
  }

  return (
    <Link className={`${className} text-decoration-none text-reset`} to={href}>
      {inner}
    </Link>
  )
}

export function FieldBoard({
  fields,
  hrefFor,
  showOrg,
  compact,
  emptyText = 'Chưa có thửa trong phạm vi đang xem.',
  canManageCover = false,
  uploadingFieldId = null,
  onCoverUpload,
}) {
  if (!fields.length) {
    return <p className="text-muted">{emptyText}</p>
  }
  return (
    <div className={compact ? 'rg-field-board rg-field-board--compact' : 'rg-field-board'}>
      {fields.map((field) => (
        <FieldTile
          key={field.id}
          field={field}
          href={hrefFor ? hrefFor(field) : undefined}
          showOrg={showOrg}
          compact={compact}
          canManageCover={canManageCover}
          uploading={uploadingFieldId === field.id}
          onCoverUpload={onCoverUpload}
        />
      ))}
    </div>
  )
}
