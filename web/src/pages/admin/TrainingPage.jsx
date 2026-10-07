import { useEffect, useState } from 'react'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { FEATURES } from '../../constants/features.js'
import { api } from '../../services/api.js'

export default function TrainingPage() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')

  function load() {
    return api.getTrainingQueue().then(setItems)
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [])

  async function approve(id) {
    await api.approveTrainingItem(id)
    await load()
  }

  return (
    <PageFrame code="B6" title={FEATURES.B6.title} description={FEATURES.B6.description}>
      <FeatureMeta code="B6" />
      {error ? <p className="text-danger">{error}</p> : null}
      <div className="table-responsive">
        <table className="rg-table">
          <thead>
            <tr>
              <th>Cảnh báo</th>
              <th>Phản hồi D4</th>
              <th>Thửa</th>
              <th>Tập train</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>{row.alertId}</td>
                <td>{row.status === 'confirmed' ? 'Chính xác' : 'Sai'}</td>
                <td>
                  {row.orgName}
                  <div className="small text-muted">{row.fieldName}</div>
                  {row.reason ? <div className="small">{row.reason}</div> : null}
                </td>
                <td>
                  {row.approved ? (
                    'Đã duyệt'
                  ) : (
                    <button type="button" className="btn btn-sm btn-rg" onClick={() => approve(row.id)}>
                      Duyệt vào train
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageFrame>
  )
}
