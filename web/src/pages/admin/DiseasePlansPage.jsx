import { useEffect, useState } from 'react'
import { DiseasePlanImportModal } from '../../components/disease/DiseasePlanImportModal.jsx'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { FEATURES } from '../../constants/features.js'
import {
  getDiseasePlans,
  refreshDiseasePlansFromApi,
  subscribeDiseasePlans,
} from '../../data/diseasePlansStore.js'

export default function DiseasePlansPage() {
  const [plans, setPlans] = useState(() =>
    getDiseasePlans().filter((row) => row.code !== 'Rice__Healthy'),
  )
  const [importOpen, setImportOpen] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    function refresh() {
      setPlans(getDiseasePlans().filter((row) => row.code !== 'Rice__Healthy'))
    }
    refresh()
    const unsub = subscribeDiseasePlans(refresh)
    let cancelled = false
    setLoading(true)
    refreshDiseasePlansFromApi()
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Không tải được phương án từ server.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  function handleImported(result) {
    const parts = []
    if (result.added > 0) parts.push(`đã thêm ${result.added} phương pháp`)
    if (result.skippedDup > 0) parts.push(`bỏ qua ${result.skippedDup} trùng`)
    if (result.unmatchedSheets?.length) {
      parts.push(`sheet không khớp: ${result.unmatchedSheets.join(', ')}`)
    }
    setStatus(
      parts.length
        ? `Import ${result.fileName || 'Excel'} thành công — ${parts.join('; ')}.`
        : `Import ${result.fileName || 'Excel'} hoàn tất (không có phương pháp mới).`,
    )
  }

  return (
    <PageFrame
      code="B9"
      title={FEATURES.B9.title}
      description={FEATURES.B9.description}
      actions={
        <button type="button" className="btn btn-rg" onClick={() => setImportOpen(true)}>
          <i className="bi bi-upload me-1" aria-hidden="true" />
          Import
        </button>
      }
    >
      <FeatureMeta code="B9" />
      <div className="alert alert-info" role="status">
        Catalog 9 lớp bệnh lưu trên server. Import Excel thêm phương pháp điều trị (đồng bộ DB để
        Admin/KTV chọn khi xác nhận cảnh báo ảnh).
      </div>
      {loading ? <p className="small text-muted">Đang tải…</p> : null}
      {error ? (
        <div className="alert alert-warning" role="status">
          {error}
        </div>
      ) : null}
      {status ? (
        <div className="alert alert-success" role="status">
          {status}
        </div>
      ) : null}
      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th scope="col">Mã</th>
              <th scope="col">Bệnh</th>
              <th scope="col">Tóm tắt</th>
              <th scope="col">Phương án xử lý</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.code}>
                <td>
                  <code className="small">{plan.code}</code>
                </td>
                <td>
                  <strong>{plan.nameVi}</strong>
                </td>
                <td className="small">{plan.summary}</td>
                <td>
                  <ol className="small mb-0 ps-3">
                    {(plan.actions || []).map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ol>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {importOpen ? (
        <DiseasePlanImportModal onClose={() => setImportOpen(false)} onImported={handleImported} />
      ) : null}
    </PageFrame>
  )
}
