import { useEffect, useState } from 'react'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { RgModal } from '../../components/layout/RgModal.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { FEATURES } from '../../constants/features.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'

export default function FarmersPage() {
  const { selectedOrgIds } = useAuth()
  const [items, setItems] = useState([])
  const [fields, setFields] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [phone, setPhone] = useState('')
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({ fullName: '', phone: '', fieldId: '' })
  const [removing, setRemoving] = useState(null)
  const [error, setError] = useState('')

  function load() {
    return Promise.all([api.getFarmers(selectedOrgIds), api.getAssignedFields(selectedOrgIds)]).then(
      ([farmers, fieldRows]) => {
        setItems(farmers)
        setFields(fieldRows)
      },
    )
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [selectedOrgIds])

  async function handleCreate(event) {
    event.preventDefault()
    await api.createFarmer(form)
    setOpen(false)
    setForm({ fullName: '', phone: '', fieldId: '' })
    await load()
  }

  async function savePhone(id) {
    await api.updateFarmerContact(id, phone)
    setEditing(null)
    await load()
  }

  async function grantApp(id) {
    await api.grantFarmerApp(id)
    setToast('Đã cấp tài khoản App (mock).')
    setTimeout(() => setToast(''), 2500)
    await load()
  }

  async function confirmDelete() {
    await api.deleteFarmer(removing.id)
    setRemoving(null)
    await load()
  }

  return (
    <PageFrame
      code="C6"
      title={FEATURES.C6.title}
      description={FEATURES.C6.description}
      actions={
        <button type="button" className="btn btn-rg" onClick={() => setOpen(true)}>
          Thêm hộ
        </button>
      }
    >
      <FeatureMeta code="C6" />
      {error ? <p className="text-danger">{error}</p> : null}
      <div className="table-responsive">
        <table className="rg-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Liên hệ</th>
              <th>Thửa</th>
              <th>App</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>{row.fullName}</td>
                <td>
                  {editing === row.id ? (
                    <>
                      <input
                        className="rg-inline-edit"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                      />
                      <button type="button" className="btn btn-rg-ghost btn-sm" onClick={() => savePhone(row.id)}>
                        Lưu
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-link p-0 text-decoration-none"
                      onClick={() => {
                        setEditing(row.id)
                        setPhone(row.phone)
                      }}
                    >
                      {row.phone}
                    </button>
                  )}
                </td>
                <td>{row.fieldNames.join(', ')}</td>
                <td>{row.appAccount ? 'Đã cấp' : 'Chưa'}</td>
                <td className="d-flex flex-wrap gap-2">
                  {row.appAccount ? null : (
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => grantApp(row.id)}>
                      Cấp tài khoản App
                    </button>
                  )}
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setRemoving(row)}>
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <RgModal title="Thêm hộ nông dân" onClose={() => setOpen(false)}>
          <form onSubmit={handleCreate}>
            <label className="form-label" htmlFor="frm-name">
              Họ tên
            </label>
            <input
              id="frm-name"
              className="form-control mb-2"
              required
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
            />
            <label className="form-label" htmlFor="frm-phone">
              Số điện thoại
            </label>
            <input
              id="frm-phone"
              className="form-control mb-2"
              required
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
            <label className="form-label" htmlFor="frm-field">
              Thửa liên kết
            </label>
            <select
              id="frm-field"
              className="form-select mb-3"
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
            <div className="d-flex gap-2 justify-content-end">
              <button type="button" className="btn btn-light" onClick={() => setOpen(false)}>
                Hủy
              </button>
              <button type="submit" className="btn btn-rg">
                Thêm
              </button>
            </div>
          </form>
        </RgModal>
      ) : null}
      {removing ? (
        <RgModal title={`Xóa hộ ${removing.fullName}?`} onClose={() => setRemoving(null)}>
          <p>Hộ sẽ biến khỏi danh sách phiên mock hiện tại.</p>
          <div className="d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-light" onClick={() => setRemoving(null)}>
              Hủy
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmDelete}>
              Xóa hộ
            </button>
          </div>
        </RgModal>
      ) : null}
      {toast ? <div className="rg-toast">{toast}</div> : null}
    </PageFrame>
  )
}
