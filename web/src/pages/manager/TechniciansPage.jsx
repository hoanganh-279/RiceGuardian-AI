import { useEffect, useState } from 'react'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { RgModal } from '../../components/layout/RgModal.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { FEATURES } from '../../constants/features.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'

export default function TechniciansPage() {
  const { selectedOrgIds } = useAuth()
  const [items, setItems] = useState([])
  const [active, setActive] = useState(null)
  const [region, setRegion] = useState('')
  const [error, setError] = useState('')

  function load() {
    return api.getOrgTechnicians(selectedOrgIds).then(setItems)
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [selectedOrgIds])

  async function saveRegion(event) {
    event.preventDefault()
    await api.assignTechnicianRegion(active.id, region)
    setActive(null)
    await load()
  }

  return (
    <PageFrame code="C2" title={FEATURES.C2.title} description={FEATURES.C2.description}>
      <FeatureMeta code="C2" />
      <p className="small text-muted">Không tự thêm/xóa KTV — liên hệ Admin (B8).</p>
      {error ? <p className="text-danger">{error}</p> : null}
      <div className="table-responsive">
        <table className="rg-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Liên hệ</th>
              <th>Vùng phụ trách</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>{row.fullName}</td>
                <td>
                  {row.phone}
                  <div className="small text-muted">{row.email}</div>
                </td>
                <td>{row.region}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      setActive(row)
                      setRegion(row.region || '')
                    }}
                  >
                    Phân công vùng
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {active ? (
        <RgModal title={`Phân công ${active.fullName}`} onClose={() => setActive(null)}>
          <form onSubmit={saveRegion}>
            <label className="form-label" htmlFor="region">
              Vùng
            </label>
            <input
              id="region"
              className="form-control mb-3"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              required
            />
            <div className="d-flex gap-2 justify-content-end">
              <button type="button" className="btn btn-light" onClick={() => setActive(null)}>
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
