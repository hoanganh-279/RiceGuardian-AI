import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { ARTICLE_CATEGORY_LABELS, ARTICLE_STATUS_LABELS, FEATURES } from '../../constants/features.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api, normalizeUploadUrl } from '../../services/api.js'

const EMPTY = {
  title: '',
  summary: '',
  body: '',
  coverUrl: '',
  category: 'ky_thuat',
  status: 'draft',
  reviewNote: '',
}

export default function ArticleEditorPage() {
  const { articleId } = useParams()
  const isNew = !articleId || articleId === 'new'
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const listPath = isAdmin ? '/admin/articles' : '/technician/articles'
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (isNew) return undefined
    let alive = true
    api
      .getArticle(articleId)
      .then((item) => {
        if (!alive) return
        setForm({
          title: item.title || '',
          summary: item.summary || '',
          body: item.body || '',
          coverUrl: item.coverUrl || '',
          category: item.category || 'ky_thuat',
          status: item.status || 'draft',
          reviewNote: item.reviewNote || '',
        })
      })
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [articleId, isNew])

  function patch(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const result = await api.uploadArticleCover(file)
      patch('coverUrl', result.coverUrl)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function saveDraft() {
    setSaving(true)
    setError('')
    try {
      const payload = {
        title: form.title,
        summary: form.summary,
        body: form.body,
        coverUrl: form.coverUrl || null,
        category: form.category,
      }
      if (isNew) {
        const created = await api.createArticle(payload)
        navigate(`${listPath}/${created.id}/edit`, { replace: true })
      } else {
        const updated = await api.updateArticle(articleId, payload)
        setForm((prev) => ({ ...prev, status: updated.status, reviewNote: updated.reviewNote || '' }))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    setSaving(true)
    setError('')
    try {
      if (isNew) {
        const created = await api.createArticle({
          title: form.title,
          summary: form.summary,
          body: form.body,
          coverUrl: form.coverUrl || null,
          category: form.category,
        })
        await api.publishArticle(created.id)
        navigate(listPath)
      } else {
        await api.updateArticle(articleId, {
          title: form.title,
          summary: form.summary,
          body: form.body,
          coverUrl: form.coverUrl || null,
          category: form.category,
        })
        await api.publishArticle(articleId)
        navigate(listPath)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitReview() {
    setSaving(true)
    setError('')
    try {
      let id = articleId
      if (isNew) {
        const created = await api.createArticle({
          title: form.title,
          summary: form.summary,
          body: form.body,
          coverUrl: form.coverUrl || null,
          category: form.category,
        })
        id = created.id
      } else {
        await api.updateArticle(articleId, {
          title: form.title,
          summary: form.summary,
          body: form.body,
          coverUrl: form.coverUrl || null,
          category: form.category,
        })
      }
      await api.submitArticleReview(id)
      navigate(listPath)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageFrame
      code="B11"
      title={isNew ? 'Viết bài mới' : 'Sửa bài'}
      description={FEATURES.B11.description}
      actions={
        <Link className="btn btn-rg-ghost" to={listPath}>
          ← Danh sách
        </Link>
      }
    >
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {!isNew ? (
        <p className="small text-muted">
          Trạng thái: <strong>{ARTICLE_STATUS_LABELS[form.status] || form.status}</strong>
          {form.reviewNote ? <> · Ghi chú duyệt: {form.reviewNote}</> : null}
        </p>
      ) : null}

      <div className="row g-3">
        <div className="col-lg-8">
          <div className="rg-md-card p-3">
            <label className="form-label">Tiêu đề</label>
            <input className="form-control mb-3" value={form.title} onChange={(e) => patch('title', e.target.value)} />
            <label className="form-label">Tóm tắt (hiện trên App)</label>
            <textarea
              className="form-control mb-3"
              rows={2}
              value={form.summary}
              onChange={(e) => patch('summary', e.target.value)}
            />
            <label className="form-label">Nội dung</label>
            <textarea
              className="form-control mb-3"
              rows={14}
              value={form.body}
              onChange={(e) => patch('body', e.target.value)}
            />
          </div>
        </div>
        <div className="col-lg-4">
          <div className="rg-md-card p-3">
            <label className="form-label">Chuyên mục</label>
            <select
              className="form-select mb-3"
              value={form.category}
              onChange={(e) => patch('category', e.target.value)}
            >
              {Object.entries(ARTICLE_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="form-label">Ảnh bìa</label>
            <input type="file" accept="image/*" className="form-control mb-2" onChange={handleUpload} disabled={uploading} />
            {form.coverUrl ? (
              <img
                src={normalizeUploadUrl(form.coverUrl)}
                alt=""
                className="img-fluid rounded mb-3"
                style={{ maxHeight: 160, objectFit: 'cover', width: '100%' }}
              />
            ) : null}
            <div className="d-grid gap-2">
              <button type="button" className="btn btn-rg-outline" disabled={saving} onClick={saveDraft}>
                Lưu nháp
              </button>
              {isAdmin ? (
                <button type="button" className="btn btn-rg" disabled={saving} onClick={handlePublish}>
                  Xuất bản
                </button>
              ) : (
                <button type="button" className="btn btn-rg" disabled={saving} onClick={handleSubmitReview}>
                  Gửi Admin duyệt
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageFrame>
  )
}
