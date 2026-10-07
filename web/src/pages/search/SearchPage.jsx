import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { FEATURES } from '../../constants/features.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'

const TYPE_CHIPS = [
  { value: '', label: 'Tất cả' },
  { value: 'field', label: 'Thửa' },
  { value: 'alert', label: 'Cảnh báo' },
  { value: 'farmer', label: 'Hộ nông dân' },
  { value: 'station', label: 'Trạm IoT' },
]

const TYPE_LABEL = {
  field: 'Thửa',
  alert: 'Cảnh báo',
  farmer: 'Hộ',
  station: 'Trạm',
}

export default function SearchPage() {
  const { selectedOrgIds, isAdmin, user } = useAuth()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [type, setType] = useState('')
  const [result, setResult] = useState({ items: [], total: 0 })
  const [error, setError] = useState('')
  const userRole = user?.role

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let alive = true
    setError('')
    api
      .search({
        q: debounced,
        types: type ? [type] : undefined,
        orgIds: selectedOrgIds,
        page: 1,
        limit: 20,
      })
      .then((payload) => {
        if (alive) setResult(payload)
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [debounced, type, selectedOrgIds])

  const chips = TYPE_CHIPS.filter((item) => {
    if (item.value === 'farmer' && !isAdmin && userRole !== 'manager') return false
    if (item.value === 'station' && userRole === 'manager') return false
    return true
  })

  return (
    <PageFrame
      code="E2"
      title={FEATURES.E2.title}
      description={FEATURES.E2.description}
      filters={
        <>
          <FeatureMeta code="E2" />
          <label className="form-label" htmlFor="rg-search">
            Từ khóa
          </label>
          <input
            id="rg-search"
            className="form-control mb-3"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Thửa, cảnh báo, hộ, mã trạm…"
          />
          <div className="rg-filter-row mb-3">
            {chips.map((item) => (
              <button
                key={item.value || 'all'}
                type="button"
                className={`rg-pill${type === item.value ? ' active' : ''}`}
                onClick={() => setType(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      }
    >
      {error ? <p className="text-danger">{error}</p> : null}
      <p className="small text-muted">{result.total} kết quả · debounce 300ms</p>
      {result.items.map((item) => (
        <article key={`${item.type}-${item.id}`} className="rg-field-row">
          <span className="rg-risk-bar rg-risk-low" />
          <div>
            {item.orgName ? <span className="rg-org-label">{item.orgName}</span> : null}
            <h2 className="h5 mb-1">{item.title}</h2>
            <div className="rg-meta">
              <span>{TYPE_LABEL[item.type]}</span>
              <span>{item.subtitle}</span>
            </div>
          </div>
          <Link to={item.href} className="small text-decoration-none">
            Mở
          </Link>
        </article>
      ))}
    </PageFrame>
  )
}
