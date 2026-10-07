import { useEffect, useState } from 'react'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { RgModal } from '../../components/layout/RgModal.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { FEATURES } from '../../constants/features.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'

function formatWhen(iso) {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function toLocalInput(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso).slice(0, 16)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const EMPTY_FORM = { fieldId: '', scheduledAt: '', alertId: '', note: '' }

export default function InspectionsPage() {
  const { selectedOrgIds } = useAuth()
  const [items, setItems] = useState([])
  const [fields, setFields] = useState([])
  const [alerts, setAlerts] = useState([])
  const [open, setOpen] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  function load() {
    return Promise.all([
      api.getInspections(selectedOrgIds),
      api.getAssignedFields(selectedOrgIds),
      api.getAlerts({ orgIds: selectedOrgIds, status: 'open', limit: 50 }),
    ]).then(([rows, fieldRows, alertRows]) => {
      setItems(rows)
      setFields(fieldRows)
      setAlerts(alertRows.items)
    })
  }

  useEffect(() => {
    let alive = true
    load().catch((err) => {
      if (alive) setError(err.message)
    })
    return () => {
      alive = false
    }
  }, [selectedOrgIds])

  async function handleSave(event) {
    event.preventDefault()
    if (form.id) await api.updateInspection(form.id, form)
    else await api.createInspection(form)
    setOpen(false)
    setForm(EMPTY_FORM)
    await load()
  }

  async function complete(id) {
    await api.completeInspection(id)
    await load()
  }

  async function confirmDelete() {
    await api.deleteInspection(removing.id)
    setRemoving(null)
    await load()
  }

  return (
    <PageFrame
      code="D10"
      title={FEATURES.D10.title}
      description={FEATURES.D10.description}
      actions={
        <button
          type="button"
          className="btn btn-rg"
          onClick={() => {
            setForm(EMPTY_FORM)
            setOpen(true)
          }}
        >
          Tạo lịch
        </button>
      }
    >
      <FeatureMeta code="D10" />
      {error ? <p className="text-danger">{error}</p> : null}
      {items.map((row) => (
        <article key={row.id} className="rg-field-row">
          <span className={`rg-risk-bar rg-risk-${row.status === 'done' ? 'low' : 'medium'}`} />
          <div>
            <span className="rg-org-label">{row.orgName}</span>
            <h2 className="h5 mb-1">{row.fieldName}</h2>
            <div className="rg-meta">
              <span>{formatWhen(row.scheduledAt)}</span>
              <span>{row.status === 'done' ? 'Hoàn thành' : 'Chưa xong'}</span>
              {row.alertId ? <span>Gắn {row.alertId}</span> : null}
              <span>{row.note}</span>
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2">
            {row.status === 'open' ? (
              <>
                <button type="button" className="btn btn-sm btn-rg" onClick={() => complete(row.id)}>
                  Hoàn thành
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    setForm({
                      id: row.id,
                      fieldId: row.fieldId,
                      scheduledAt: toLocalInput(row.scheduledAt),
                      alertId: row.alertId || '',
                      note: row.note || '',
                    })
                    setOpen(true)
                  }}
                >
                  Sửa
                </button>
              </>
            ) : null}
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setRemoving(row)}>
              Xóa
            </button>
          </div>
        </article>
      ))}
      {open ? (
        <RgModal title={form.id ? 'Sửa lịch kiểm tra' : 'Lịch kiểm tra thực địa'} onClose={() => setOpen(false)}>
          <form onSubmit={handleSave}>
            <label className="form-label" htmlFor="ins-field">
              Thửa
            </label>
            <select
              id="ins-field"
              className="form-select mb-2"
              required
              value={form.fieldId}
              onChange={(event) => setForm({ ...form, fieldId: event.target.value })}
            >
              <option value="">Chọn thửa</option>
              {fields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.name}
                </option>
              ))}
            </select>
            <label className="form-label" htmlFor="ins-when">
              Thời điểm
            </label>
            <input
              id="ins-when"
              type="datetime-local"
              className="form-control mb-2"
              required
              value={form.scheduledAt}
              onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })}
            />
            <label className="form-label" htmlFor="ins-alert">
              Cảnh báo liên kết (D4)
            </label>
            <select
              id="ins-alert"
              className="form-select mb-2"
              value={form.alertId}
              onChange={(event) => setForm({ ...form, alertId: event.target.value })}
            >
              <option value="">Không gắn</option>
              {alerts.map((alert) => (
                <option key={alert.id} value={alert.id}>
                  {alert.title}
                </option>
              ))}
            </select>
            <label className="form-label" htmlFor="ins-note">
              Ghi chú
            </label>
            <textarea
              id="ins-note"
              className="form-control mb-3"
              rows="2"
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
            <div className="d-flex gap-2 justify-content-end">
              <button type="button" className="btn btn-light" onClick={() => setOpen(false)}>
                Hủy
              </button>
              <button type="submit" className="btn btn-rg">
                Lưu
              </button>
            </div>
          </form>
        </RgModal>
      ) : null}
      {removing ? (
        <RgModal title="Xóa lịch kiểm tra?" onClose={() => setRemoving(null)}>
          <p>
            {removing.fieldName} · {formatWhen(removing.scheduledAt)}
          </p>
          <div className="d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-light" onClick={() => setRemoving(null)}>
              Hủy
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmDelete}>
              Xóa
            </button>
          </div>
        </RgModal>
      ) : null}
    </PageFrame>
  )
}
