import { List } from 'react-window'
import { useEffect, useMemo, useState } from 'react'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { FEATURES } from '../../constants/features.js'
import { api } from '../../services/api.js'

function formatWhen(iso) {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function AuditRow({ index, style, items }) {
  const row = items[index]
  if (!row) return null
  return (
    <div style={style} className="rg-virtual-row">
      <span className="rg-risk-bar rg-risk-low" />
      <div>
        <strong>{row.action}</strong>
        <div className="rg-meta">
          <span>{formatWhen(row.at)}</span>
          <span>{row.actor}</span>
          <span>{row.target}</span>
          <span>{row.detail}</span>
        </div>
      </div>
    </div>
  )
}

export default function AuditLogPage() {
  const [action, setAction] = useState('')
  const [result, setResult] = useState({ items: [], total: 0 })
  const [error, setError] = useState('')
  const rowProps = useMemo(() => ({ items: result.items }), [result.items])

  useEffect(() => {
    api
      .getAuditLogs({ action: action || undefined, limit: 80 })
      .then(setResult)
      .catch((err) => setError(err.message))
  }, [action])

  return (
    <PageFrame
      code="B7"
      title={FEATURES.B7.title}
      description={FEATURES.B7.description}
      filters={
        <div className="rg-filter-row mb-3">
          {['', 'lock_user', 'create_org', 'assign_ktv', 'apply_ai_config', 'approve_training'].map((value) => (
            <button
              key={value || 'all'}
              type="button"
              className={`rg-pill${action === value ? ' active' : ''}`}
              onClick={() => setAction(value)}
            >
              {value || 'Tất cả'}
            </button>
          ))}
        </div>
      }
    >
      <FeatureMeta code="B7" />
      {error ? <p className="text-danger">{error}</p> : null}
      <p className="small text-muted">{result.total} dòng</p>
      <List
        className="rg-virtual-list"
        rowComponent={AuditRow}
        rowCount={result.items.length}
        rowHeight={64}
        rowProps={rowProps}
        style={{ height: 420 }}
      />
    </PageFrame>
  )
}
