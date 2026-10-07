import { useEffect, useState } from 'react'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { RgModal } from '../../components/layout/RgModal.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { FEATURES } from '../../constants/features.js'
import { ORGANIZATIONS } from '../../data/mockUsers.js'
import { api } from '../../services/api.js'

export default function AssignmentsPage() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState('')
  const [orgId, setOrgId] = useState('')
  const [error, setError] = useState('')

  function load() {
    return api.getAssignments().then(setItems)
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [])

  async function assign(event) {
    event.preventDefault()
    await api.assignKtv(userId, orgId)
    setOpen(false)
    await load()
  }

  async function unassign(userIdValue, orgIdValue) {
    await api.unassignKtv(userIdValue, orgIdValue)
    await load()
  }

  return (
    <PageFrame
      code="B8"
      title={FEATURES.B8.title}
      description={FEATURES.B8.description}
      actions={
        <button type="button" className="btn btn-rg" onClick={() => setOpen(true)}>
          Gán KTV
        </button>
      }
    >
      <FeatureMeta code="B8" />
      {error ? <p className="text-danger">{error}</p> : null}
      {items.map((row) => (
        <article key={row.id} className="rg-field-row">
          <span className="rg-risk-bar rg-risk-low" />
          <div>
            <h2 className="h5 mb-1">{row.fullName}</h2>
            <div className="rg-meta">
              {row.orgIds.length ? (
                row.orgIds.map((id, index) => (
                  <span key={id}>
                    {row.orgNames[index]}
                    <button type="button" className="btn btn-rg-ghost btn-sm ms-1" onClick={() => unassign(row.id, id)}>
                      Gỡ
                    </button>
                  </span>
                ))
              ) : (
                <span>Chưa gán đơn vị</span>
              )}
            </div>
          </div>
        </article>
      ))}
      {open ? (
        <RgModal title="Gán kỹ thuật viên" onClose={() => setOpen(false)}>
          <form onSubmit={assign}>
            <label className="form-label" htmlFor="asg-user">
              KTV
            </label>
            <select
              id="asg-user"
              className="form-select mb-2"
              required
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            >
              <option value="">Chọn</option>
              {items.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.fullName}
                </option>
              ))}
            </select>
            <label className="form-label" htmlFor="asg-org">
              Đơn vị
            </label>
            <select
              id="asg-org"
              className="form-select mb-3"
              required
              value={orgId}
              onChange={(event) => setOrgId(event.target.value)}
            >
              <option value="">Chọn</option>
              {ORGANIZATIONS.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <div className="d-flex gap-2 justify-content-end">
              <button type="button" className="btn btn-light" onClick={() => setOpen(false)}>
                Hủy
              </button>
              <button type="submit" className="btn btn-rg">
                Gán
              </button>
            </div>
          </form>
        </RgModal>
      ) : null}
    </PageFrame>
  )
}
