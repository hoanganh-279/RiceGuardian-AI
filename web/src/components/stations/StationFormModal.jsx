import { useState } from 'react'
import { RgModal } from '../layout/RgModal.jsx'

export function StationFormModal({ title, fields, initial, allowUnassigned, lockField, onClose, onSubmit }) {
  const [form, setForm] = useState({
    code: initial?.code || '',
    name: initial?.name || '',
    fieldId: initial?.fieldId || '',
    lat: initial?.lat ?? '',
    lng: initial?.lng ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onSubmit({
        code: form.code.trim(),
        name: form.name.trim(),
        fieldId: form.fieldId || null,
        lat: form.lat,
        lng: form.lng,
      })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <RgModal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error ? <p className="text-danger">{error}</p> : null}
        <label className="form-label" htmlFor="st-code">
          Mã trạm
        </label>
        <input
          id="st-code"
          className="form-control mb-2"
          required
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value })}
        />
        <label className="form-label" htmlFor="st-name">
          Tên
        </label>
        <input
          id="st-name"
          className="form-control mb-2"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <label className="form-label" htmlFor="st-field">
          Thửa
        </label>
        <select
          id="st-field"
          className="form-select mb-3"
          required={!allowUnassigned}
          disabled={lockField}
          value={form.fieldId}
          onChange={(event) => setForm({ ...form, fieldId: event.target.value })}
        >
          <option value="">{allowUnassigned ? 'Chưa gán' : 'Chọn thửa'}</option>
          {fields.map((field) => (
            <option key={field.id} value={field.id}>
              {field.orgName} · {field.name}
            </option>
          ))}
        </select>
        <label className="form-label" htmlFor="st-lat">
          Vĩ độ
        </label>
        <input
          id="st-lat"
          className="form-control mb-2"
          value={form.lat}
          onChange={(event) => setForm({ ...form, lat: event.target.value })}
        />
        <label className="form-label" htmlFor="st-lng">
          Kinh độ
        </label>
        <input
          id="st-lng"
          className="form-control mb-3"
          value={form.lng}
          onChange={(event) => setForm({ ...form, lng: event.target.value })}
        />
        <div className="d-flex gap-2 justify-content-end">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn btn-rg" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </form>
    </RgModal>
  )
}
