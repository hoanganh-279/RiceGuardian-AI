import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { RgModal } from '../../components/layout/RgModal.jsx'
import {
  ARTICLE_CATEGORY_LABELS,
  ARTICLE_STATUS_LABELS,
  FEATURES,
} from '../../constants/features.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api, normalizeUploadUrl } from '../../services/api.js'

function statusClass(status) {
  if (status === 'published') return 'text-bg-success'
  if (status === 'pending_review') return 'text-bg-warning'
  if (status === 'archived') return 'text-bg-secondary'
  return 'text-bg-light'
}

export default function ArticlesListPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const base = isAdmin ? '/admin/articles' : '/technician/articles'
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [q, setQ] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectNote, setRejectNote] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await api.getArticles({
        page: 1,
        limit: 50,
        status,
        category,
        q,
        pendingOnly: isAdmin && pendingOnly,
      })
      setItems(result.items || [])
      setTotal(result.total || 0)
    } catch (err) {
      setError(err.message || 'Không tải được bản tin.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [status, category, pendingOnly])

  async function handleApprove(id) {
    try {
      await api.approveArticle(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleReject() {
    if (!rejectTarget) return
    try {
      await api.rejectArticle(rejectTarget.id, rejectNote)
      setRejectTarget(null)
      setRejectNote('')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handlePublish(id) {
    try {
      await api.publishArticle(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleArchive(id) {
    try {
      await api.archiveArticle(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <PageFrame
      code="B11"
      title={FEATURES.B11.title}
      description={FEATURES.B11.description}
      actions={
        <button type="button" className="btn btn-rg" onClick={() => navigate(`${base}/new`)}>
          + Viết bài mới
        </button>
      }
    >
      <div className="rg-md-toolbar mb-3">
        <input
          className="form-control form-control-sm rg-md-search"
          placeholder="Tìm theo tiêu đề…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select className="form-select form-select-sm rg-md-filter" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(ARTICLE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="form-select form-select-sm rg-md-filter"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Mọi chuyên mục</option>
          {Object.entries(ARTICLE_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {isAdmin ? (
          <label className="form-check form-check-inline small mb-0">
            <input
              type="checkbox"
              className="form-check-input"
              checked={pendingOnly}
              onChange={(e) => setPendingOnly(e.target.checked)}
            />{' '}
            Chỉ chờ duyệt
          </label>
        ) : null}
        <button type="button" className="btn btn-sm btn-rg-outline" onClick={load}>
          Lọc
        </button>
        <span className="rg-md-count">{total} kết quả</span>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {loading ? <p className="text-muted">Đang tải…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="text-muted">Chưa có bài viết.</p>
      ) : (
        <table className="rg-table">
          <thead>
            <tr>
              <th>Bìa</th>
              <th>Tiêu đề</th>
              <th>Chuyên mục</th>
              <th>Trạng thái</th>
              <th>Tác giả</th>
              <th>Hỏi mở</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.coverUrl ? (
                    <img
                      src={normalizeUploadUrl(row.coverUrl)}
                      alt=""
                      width={48}
                      height={48}
                      style={{ objectFit: 'cover', borderRadius: 8 }}
                    />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  <strong>{row.title}</strong>
                  <div className="small text-muted text-truncate" style={{ maxWidth: 280 }}>
                    {row.summary}
                  </div>
                  {row.reviewNote ? <div className="small text-danger">Ghi chú duyệt: {row.reviewNote}</div> : null}
                </td>
                <td>{ARTICLE_CATEGORY_LABELS[row.category] || row.category}</td>
                <td>
                  <span className={`badge ${statusClass(row.status)}`}>
                    {ARTICLE_STATUS_LABELS[row.status] || row.status}
                  </span>
                </td>
                <td>{row.authorName}</td>
                <td>
                  {row.openQuestionCount > 0 ? (
                    <span className="badge text-bg-warning">{row.openQuestionCount}</span>
                  ) : (
                    0
                  )}
                </td>
                <td className="text-end text-nowrap">
                  <Link className="btn btn-sm btn-rg-ghost" to={`${base}/${row.id}/edit`}>
                    Sửa
                  </Link>
                  {isAdmin && row.status === 'pending_review' ? (
                    <>
                      <button type="button" className="btn btn-sm btn-rg" onClick={() => handleApprove(row.id)}>
                        Duyệt
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-rg-outline"
                        onClick={() => setRejectTarget(row)}
                      >
                        Từ chối
                      </button>
                    </>
                  ) : null}
                  {isAdmin && row.status === 'draft' ? (
                    <button type="button" className="btn btn-sm btn-rg" onClick={() => handlePublish(row.id)}>
                      Xuất bản
                    </button>
                  ) : null}
                  {isAdmin && row.status === 'published' ? (
                    <button type="button" className="btn btn-sm btn-rg-outline" onClick={() => handleArchive(row.id)}>
                      Lưu trữ
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rejectTarget ? (
        <RgModal title="Từ chối duyệt" onClose={() => setRejectTarget(null)}>
          <p className="small text-muted">Bài: {rejectTarget.title}</p>
          <textarea
            className="form-control mb-3"
            rows={3}
            placeholder="Lý do / yêu cầu chỉnh sửa"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
          <div className="d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-rg-ghost" onClick={() => setRejectTarget(null)}>
              Hủy
            </button>
            <button type="button" className="btn btn-rg-danger" onClick={handleReject}>
              Trả về nháp
            </button>
          </div>
        </RgModal>
      ) : null}
    </PageFrame>
  )
}
