import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { RgModal } from '../../components/layout/RgModal.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { RISK_LABEL } from '../../constants/alerts.js'
import { FEATURES } from '../../constants/features.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'
import { METRIC_DASH } from '../../utils/metricDisplay.js'

export default function FieldsPage() {
  const { selectedOrgIds } = useAuth()
  const [items, setItems] = useState([])
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState({})
  const [removing, setRemoving] = useState(null)
  const [error, setError] = useState('')

  function load() {
    return api.getAssignedFields(selectedOrgIds).then(setItems)
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [selectedOrgIds])

  async function saveInline(field) {
    await api.updateField(field.id, {
      name: draft.name,
      areaHa: Number(draft.areaHa),
      variety: draft.variety,
    })
    setEditing(null)
    await load()
  }

  async function confirmDelete() {
    try {
      await api.deleteField(removing.id)
      setRemoving(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <PageFrame
      code="C3"
      title={FEATURES.C3.title}
      description={FEATURES.C3.description}
      actions={
        <Link className="btn btn-rg" to="/manager/fields/new">
          Thêm thửa
        </Link>
      }
    >
      <FeatureMeta code="C3" />
      {error ? <p className="text-danger">{error}</p> : null}
      <div className="table-responsive mb-3">
        <table className="rg-table">
          <thead>
            <tr>
              <th>Thửa</th>
              <th>Diện tích</th>
              <th>Giống</th>
              <th>Nguy cơ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((field) => (
              <tr key={field.id}>
                <td>
                  {editing === field.id ? (
                    <input
                      className="rg-inline-edit"
                      value={draft.name}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    />
                  ) : (
                    <button
                      type="button"
                      className="btn btn-link p-0 text-decoration-none"
                      onClick={() => {
                        setEditing(field.id)
                        setDraft(field)
                      }}
                    >
                      {field.name}
                    </button>
                  )}
                </td>
                <td>
                  {editing === field.id ? (
                    <input
                      className="rg-inline-edit"
                      type="number"
                      step="0.1"
                      value={draft.areaHa}
                      onChange={(event) => setDraft({ ...draft, areaHa: event.target.value })}
                    />
                  ) : (
                    `${METRIC_DASH}`
                  )}
                </td>
                <td>
                  {editing === field.id ? (
                    <input
                      className="rg-inline-edit"
                      value={draft.variety}
                      onChange={(event) => setDraft({ ...draft, variety: event.target.value })}
                    />
                  ) : (
                    field.variety
                  )}
                </td>
                <td>{RISK_LABEL[field.riskLevel]}</td>
                <td className="d-flex flex-wrap gap-2">
                  {editing === field.id ? (
                    <button type="button" className="btn btn-sm btn-rg" onClick={() => saveInline(field)}>
                      Lưu
                    </button>
                  ) : (
                    <>
                      <Link className="btn btn-sm btn-outline-secondary" to={`/manager/fields/${field.id}/boundary`}>
                        Sửa ranh giới
                      </Link>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setRemoving(field)}>
                        Xóa
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {removing ? (
        <RgModal title={`Xóa ${removing.name}?`} onClose={() => setRemoving(null)}>
          <p>Thửa còn trạm IoT sẽ không xóa được. Thao tác chỉ tồn tại trong phiên mock hiện tại.</p>
          <div className="d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-light" onClick={() => setRemoving(null)}>
              Hủy
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmDelete}>
              Xóa thửa
            </button>
          </div>
        </RgModal>
      ) : null}
    </PageFrame>
  )
}
