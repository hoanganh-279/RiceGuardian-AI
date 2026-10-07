import { useEffect, useState } from 'react'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { MasterDetailLayout } from '../../components/workspace/MasterDetailLayout.jsx'
import { FEATURES, QUESTION_STATUS_LABELS } from '../../constants/features.js'
import { api } from '../../services/api.js'

export default function ArticleQuestionsPage() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('open')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [answer, setAnswer] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [notify, setNotify] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function loadList() {
    setLoading(true)
    setError('')
    try {
      const result = await api.getArticleQuestions({ page: 1, limit: 50, status, q })
      setItems(result.items || [])
      if (selectedId && !(result.items || []).some((row) => row.id === selectedId)) {
        setSelectedId(null)
        setDetail(null)
      }
    } catch (err) {
      setError(err.message || 'Không tải được hỏi đáp.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadList()
  }, [status])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return undefined
    }
    let alive = true
    api
      .getArticleQuestion(selectedId)
      .then((item) => {
        if (!alive) return
        setDetail(item)
        setAnswer(item.answerBody || '')
        setIsPublic(Boolean(item.isPublic))
      })
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [selectedId])

  async function handleReply() {
    if (!selectedId) return
    setSaving(true)
    setError('')
    try {
      const updated = await api.replyArticleQuestion(selectedId, {
        answerBody: answer,
        isPublic,
        notify,
      })
      setDetail(updated)
      await loadList()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleHide() {
    if (!selectedId) return
    setSaving(true)
    try {
      await api.hideArticleQuestion(selectedId)
      setSelectedId(null)
      await loadList()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageFrame code="B12" title={FEATURES.B12.title} description={FEATURES.B12.description}>
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      <div className="rg-md-toolbar mb-3">
        <input
          className="form-control form-control-sm rg-md-search"
          placeholder="Tìm nội dung / bài / nông dân…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadList()}
        />
        <select className="form-select form-select-sm rg-md-filter" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả</option>
          {Object.entries(QUESTION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-sm btn-rg-outline" onClick={loadList}>
          Lọc
        </button>
      </div>

      <MasterDetailLayout
        master={
          <div className="rg-md-detail-body">
            {loading ? <p className="text-muted p-2">Đang tải…</p> : null}
            {!loading && items.length === 0 ? <p className="text-muted p-2">Không có câu hỏi.</p> : null}
            <ul className="list-unstyled mb-0">
              {items.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`w-100 text-start border-0 border-bottom bg-transparent p-3${
                      selectedId === row.id ? ' rg-primary-soft' : ''
                    }`}
                    style={selectedId === row.id ? { background: 'var(--rg-primary-soft)' } : undefined}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <div className="fw-semibold">{row.farmerName}</div>
                    <div className="small text-truncate">{row.body}</div>
                    <div className="small text-muted text-truncate">{row.articleTitle}</div>
                    <span className="badge text-bg-light">{QUESTION_STATUS_LABELS[row.status] || row.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        }
        detail={
          <div className="rg-md-detail-body p-3">
            {!detail ? (
              <p className="text-muted">Chọn một câu hỏi để trả lời.</p>
            ) : (
              <>
                <div className="mb-3">
                  <div className="small text-muted">Bài viết</div>
                  <strong>{detail.articleTitle}</strong>
                </div>
                <div className="rg-md-card p-3 mb-3">
                  <div className="small text-muted mb-1">Câu hỏi · {detail.farmerName}</div>
                  <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                    {detail.body}
                  </p>
                </div>
                {detail.status === 'answered' ? (
                  <div className="border-start border-3 border-success ps-3 mb-3">
                    <div className="small text-muted">Đã trả lời · {detail.answeredByName}</div>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{detail.answerBody}</p>
                  </div>
                ) : null}
                {detail.status !== 'hidden' ? (
                  <>
                    <label className="form-label">Câu trả lời</label>
                    <textarea
                      className="form-control mb-2"
                      rows={5}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                    />
                    <label className="form-check mb-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                      />{' '}
                      Công khai thành FAQ dưới bài trên App
                    </label>
                    <label className="form-check mb-3">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={notify}
                        onChange={(e) => setNotify(e.target.checked)}
                      />{' '}
                      Gửi thông báo cho nông dân
                    </label>
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-rg" disabled={saving} onClick={handleReply}>
                        Gửi trả lời
                      </button>
                      <button type="button" className="btn btn-rg-outline text-danger" disabled={saving} onClick={handleHide}>
                        Ẩn câu hỏi
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-muted">Câu hỏi đã ẩn.</p>
                )}
              </>
            )}
          </div>
        }
      />
    </PageFrame>
  )
}
