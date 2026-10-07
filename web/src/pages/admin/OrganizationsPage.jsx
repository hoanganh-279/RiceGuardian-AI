import { useEffect, useState } from 'react'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { RgModal } from '../../components/layout/RgModal.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { FEATURES } from '../../constants/features.js'
import { api } from '../../services/api.js'

export default function OrganizationsPage() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  function load() {
    return api.getOrganizationsAdmin().then(setItems)
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [])

  async function handleCreate(event) {
    event.preventDefault()
    if (editing) await api.updateOrganization(editing.id, { name })
    else await api.createOrganization({ name })
    setOpen(false)
    setEditing(null)
    setName('')
    await load()
  }

  async function toggle(id) {
    try {
      await api.toggleOrganization(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function approve(id) {
    try {
      await api.approveOrganization(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <PageFrame
      code="B2"
      title={FEATURES.B2.title}
      description={FEATURES.B2.description}
      actions={
        <button
          type="button"
          className="btn btn-rg"
          onClick={() => {
            setEditing(null)
            setName('')
            setOpen(true)
          }}
        >
          Tạo đơn vị
        </button>
      }
    >
      <FeatureMeta code="B2" />
      {error ? <p className="text-danger">{error}</p> : null}
      <div className="table-responsive">
        <table className="rg-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Thửa</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.fieldCount}</td>
                <td>
                  {row.status === 'pending' ? 'Chờ duyệt' : row.status === 'locked' ? 'Khóa' : 'Hoạt động'}
                </td>
                <td className="d-flex flex-wrap gap-2">
                  {row.status === 'pending' ? (
                    <button type="button" className="btn btn-sm btn-rg" onClick={() => approve(row.id)}>
                      Duyệt
                    </button>
                  ) : (
                    <button type="button" className="btn btn-sm btn-rg-ghost" onClick={() => toggle(row.id)}>
                      {row.status === 'locked' ? 'Mở' : 'Khóa'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      setEditing(row)
                      setName(row.name)
                      setOpen(true)
                    }}
                  >
                    Sửa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <RgModal title={editing ? 'Sửa đơn vị' : 'Tạo đơn vị'} onClose={() => setOpen(false)}>
          <form onSubmit={handleCreate}>
            <label className="form-label" htmlFor="org-name">
              Tên
            </label>
            <input
              id="org-name"
              className="form-control mb-3"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
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
    </PageFrame>
  )
}
