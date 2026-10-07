import { useState } from 'react'
import { namesMatch } from '../../data/diseaseCatalog.js'
import { formatWhen } from '../workspace/format.js'

function percent(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Math.round(Number(value) * 100)}%`
}

export function PhotoReviewPanel({ photo, onRescan, onReview }) {
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [reviewing, setReviewing] = useState(false)

  const match = photo.match ?? namesMatch(photo.disease, photo.rescanDisease || photo.rescanClass)
  const hasRescan = Boolean(photo.rescanDisease || photo.rescanClass)
  const solution = photo.solution

  async function handleRescan() {
    setError('')
    setScanning(true)
    try {
      await onRescan()
    } catch (err) {
      setError(err.message)
    } finally {
      setScanning(false)
    }
  }

  async function handleReview() {
    setError('')
    setReviewing(true)
    try {
      await onReview()
    } catch (err) {
      setError(err.message)
      setReviewing(false)
    }
  }

  return (
    <div className="rg-md-panel">
      <p className="small text-muted mb-3">
        {photo.fieldName} · {photo.orgName} · {photo.farmerName}
      </p>
      {photo.imageUrl ? (
        <img className="rg-review-image mb-3" src={photo.imageUrl} alt={photo.disease || 'Ảnh lúa'} />
      ) : (
        <div className={`rg-photo-swatch rg-risk-${photo.confidence > 0.75 ? 'high' : 'medium'} mb-3`} />
      )}
      <div className="rg-meta mb-3">
        <span>{formatWhen(photo.capturedAt)}</span>
        {photo.lat != null ? (
          <span>
            {photo.lat}, {photo.lng}
          </span>
        ) : null}
      </div>
      <div className="rg-compare-grid mb-3">
        <section>
          <h3 className="h6">App nông dân</h3>
          <p className="mb-1">{photo.disease || '—'}</p>
          <p className="small text-muted mb-0">Tin cậy {percent(photo.confidence)}</p>
        </section>
        <section>
          <h3 className="h6">Web quét lại</h3>
          {hasRescan ? (
            <>
              <p className="mb-1">{photo.rescanDisease || '—'}</p>
              <p className="small text-muted mb-1">Tin cậy {percent(photo.rescanConfidence)}</p>
              <p className="small text-muted mb-0">Lúc {formatWhen(photo.rescanAt)}</p>
            </>
          ) : (
            <p className="small text-muted mb-0">Chưa quét lại trên web.</p>
          )}
        </section>
      </div>
      {hasRescan ? (
        <p className={`rg-match-badge ${match ? 'is-match' : 'is-mismatch'}`}>
          {match ? 'Khớp với kết quả App' : 'Lệch so với kết quả App'}
        </p>
      ) : null}
      {solution ? (
        <div className="rg-solution mb-3">
          <h3 className="h6">{solution.nameVi}</h3>
          <p className="mb-2">{solution.summary}</p>
          <ul className="mb-0">
            {solution.actions.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <p className="text-danger">{error}</p> : null}
      <div className="d-flex flex-wrap gap-2">
        <button type="button" className="btn btn-rg-outline" onClick={handleRescan} disabled={scanning || reviewing}>
          {scanning ? 'Đang quét…' : 'Quét lại'}
        </button>
        {photo.reviewed ? (
          <p className="small text-muted mb-0 align-self-center">Đã xem xét</p>
        ) : (
          <button type="button" className="btn btn-rg" onClick={handleReview} disabled={reviewing}>
            {reviewing ? 'Đang lưu…' : 'Xác nhận đã xem xét'}
          </button>
        )}
      </div>
    </div>
  )
}
