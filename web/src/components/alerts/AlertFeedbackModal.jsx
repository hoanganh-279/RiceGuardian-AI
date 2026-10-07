import { useEffect, useMemo, useState } from 'react'
import { ALERT_TYPE_HINT, ALERT_TYPE_LABEL, FEEDBACK_OPTIONS } from '../../constants/alerts.js'
import { api } from '../../services/api.js'

function pickDefaultCode(alert, plans) {
  const suggested = alert?.suggestedSolution?.code
  if (suggested && plans.some((p) => p.code === suggested)) return suggested
  const names = [alert?.rescanDisease, alert?.photoDisease, alert?.suggestedDisease]
  for (const name of names) {
    if (!name) continue
    const hit = plans.find(
      (p) => p.nameVi.toLowerCase() === String(name).toLowerCase() || p.code === name,
    )
    if (hit) return hit.code
  }
  return plans.find((p) => p.code !== 'Rice__Healthy')?.code || plans[0]?.code || ''
}

export function AlertFeedbackModal({ alert, onClose, onSaved }) {
  const [status, setStatus] = useState('confirmed')
  const [reason, setReason] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [plans, setPlans] = useState([])
  const [diseaseCode, setDiseaseCode] = useState('')
  const [selectedActions, setSelectedActions] = useState([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [loadingPlans, setLoadingPlans] = useState(false)

  const needsTreatment = alert?.type === 'image' || Boolean(alert?.photoId)

  useEffect(() => {
    if (!needsTreatment) return undefined
    let cancelled = false
    setLoadingPlans(true)
    api
      .getDiseasePlans()
      .then((result) => {
        if (cancelled) return
        const items = (result.items || []).filter((row) => row.code !== 'Rice__Healthy')
        setPlans(items)
        const code = pickDefaultCode(alert, items)
        setDiseaseCode(code)
        const plan = items.find((p) => p.code === code)
        setSelectedActions(plan?.actions ? [...plan.actions] : [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Không tải được danh mục phương án.')
      })
      .finally(() => {
        if (!cancelled) setLoadingPlans(false)
      })
    return () => {
      cancelled = true
    }
  }, [alert, needsTreatment])

  const currentPlan = useMemo(
    () => plans.find((p) => p.code === diseaseCode) || null,
    [plans, diseaseCode],
  )

  function handleDiseaseChange(code) {
    setDiseaseCode(code)
    const plan = plans.find((p) => p.code === code)
    setSelectedActions(plan?.actions ? [...plan.actions] : [])
  }

  function toggleAction(action) {
    setSelectedActions((prev) =>
      prev.includes(action) ? prev.filter((item) => item !== action) : [...prev, action],
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (status === 'incorrect' && !reason.trim()) {
      setError('Cần nhập lý do khi chọn Sai.')
      return
    }
    if (status === 'confirmed' && needsTreatment) {
      if (!diseaseCode) {
        setError('Cần chọn bệnh / phương án điều trị.')
        return
      }
      if (selectedActions.length === 0) {
        setError('Cần chọn ít nhất một bước điều trị.')
        return
      }
    }
    setPending(true)
    try {
      await onSaved({
        status,
        reason,
        photoName,
        diseaseCode: status === 'confirmed' && needsTreatment ? diseaseCode : undefined,
        actions: status === 'confirmed' && needsTreatment ? selectedActions : undefined,
      })
    } catch (err) {
      setError(err.message)
      setPending(false)
    }
  }

  return (
    <div className="rg-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="rg-modal rg-modal-lg"
        role="dialog"
        aria-labelledby="feedback-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="feedback-title" className="h4 mb-1">
          Phản hồi cảnh báo
        </h2>
        <p className="small text-muted mb-3">
          {alert.fieldName} · {alert.orgName}
          {alert.farmerName ? ` · ${alert.farmerName}` : ''}
        </p>
        <p className="mb-3">
          <span className={`rg-chip rg-chip-${alert.type}`}>{ALERT_TYPE_LABEL[alert.type]}</span>
          <span className="d-block small text-muted mt-1">{ALERT_TYPE_HINT[alert.type]}</span>
        </p>
        <p className="mb-3">{alert.summary}</p>
        <form onSubmit={handleSubmit}>
          <fieldset className="mb-3">
            <legend className="form-label">Kết luận</legend>
            {FEEDBACK_OPTIONS.map((option) => (
              <label key={option.value} className="d-flex align-items-center gap-2 mb-1">
                <input
                  type="radio"
                  name="feedback"
                  value={option.value}
                  checked={status === option.value}
                  onChange={() => setStatus(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          {status === 'confirmed' && needsTreatment ? (
            <div className="mb-3">
              <label className="form-label" htmlFor="treatment-disease">
                Phương án giải quyết bệnh (bắt buộc)
              </label>
              {loadingPlans ? (
                <p className="small text-muted mb-0">Đang tải danh mục…</p>
              ) : (
                <>
                  <select
                    id="treatment-disease"
                    className="form-select mb-2"
                    value={diseaseCode}
                    onChange={(event) => handleDiseaseChange(event.target.value)}
                    required
                  >
                    {plans.map((plan) => (
                      <option key={plan.code} value={plan.code}>
                        {plan.nameVi}
                      </option>
                    ))}
                  </select>
                  {currentPlan?.summary ? (
                    <p className="small text-muted">{currentPlan.summary}</p>
                  ) : null}
                  <fieldset>
                    <legend className="form-label">Các bước gửi cho nông dân</legend>
                    {(currentPlan?.actions || []).map((action) => (
                      <label key={action} className="d-flex align-items-start gap-2 mb-2">
                        <input
                          type="checkbox"
                          className="form-check-input mt-1"
                          checked={selectedActions.includes(action)}
                          onChange={() => toggleAction(action)}
                        />
                        <span className="small">{action}</span>
                      </label>
                    ))}
                  </fieldset>
                </>
              )}
            </div>
          ) : null}
          {status === 'incorrect' ? (
            <div className="mb-3">
              <label className="form-label" htmlFor="feedback-reason">
                Lý do (bắt buộc)
              </label>
              <textarea
                id="feedback-reason"
                className="form-control"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
              />
            </div>
          ) : null}
          <div className="mb-3">
            <label className="form-label" htmlFor="feedback-photo">
              Ảnh đính kèm (tùy chọn)
            </label>
            <input
              id="feedback-photo"
              type="file"
              accept="image/*"
              className="form-control"
              onChange={(event) => setPhotoName(event.target.files?.[0]?.name || '')}
            />
          </div>
          {error ? <p className="text-danger">{error}</p> : null}
          <div className="d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-light" onClick={onClose} disabled={pending}>
              Hủy
            </button>
            <button type="submit" className="btn btn-rg" disabled={pending || loadingPlans}>
              {pending ? 'Đang lưu…' : 'Gửi phản hồi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
