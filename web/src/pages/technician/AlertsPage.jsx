import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { AlertFeedbackModal } from '../../components/alerts/AlertFeedbackModal.jsx'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { DataTable } from '../../components/workspace/DataTable.jsx'
import { DetailHeader } from '../../components/workspace/DetailHeader.jsx'
import { FilterActionBar } from '../../components/workspace/FilterActionBar.jsx'
import { MasterDetailLayout } from '../../components/workspace/MasterDetailLayout.jsx'
import { MasterItem, MasterList } from '../../components/workspace/MasterList.jsx'
import { StatusPill } from '../../components/workspace/StatusPill.jsx'
import { formatWhen } from '../../components/workspace/format.js'
import {
  ALERT_STATUS_LABEL,
  ALERT_TYPE_LABEL,
  RISK_LABEL,
} from '../../constants/alerts.js'
import { FEATURES } from '../../constants/features.js'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import { api } from '../../services/api.js'
import { METRIC_DASH } from '../../utils/metricDisplay.js'

const RISK_TONE = { high: 'danger', medium: 'warning', low: 'success' }
const STATUS_TONE = { open: 'warning', confirmed: 'success', incorrect: 'danger', watch: 'info' }
const TYPE_TONE = { environment: 'warning', image: 'info' }

function worstRisk(alerts) {
  if (alerts.some((row) => row.riskLevel === 'high')) return 'high'
  if (alerts.some((row) => row.riskLevel === 'medium')) return 'medium'
  return 'low'
}

export default function AlertsPage() {
  const { selectedOrgIds, organizations, isAdmin } = useAuth()
  const [searchParams] = useSearchParams()
  const queryType = searchParams.get('type') || ''
  const diseaseOnly = isAdmin && queryType === 'image'
  const initialType = diseaseOnly ? 'image' : queryType === 'environment' ? 'environment' : ''

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [fieldId, setFieldId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [feedbackAlert, setFeedbackAlert] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState(initialType)
  const [statusFilter, setStatusFilter] = useState('')
  const [appliedType, setAppliedType] = useState(initialType)
  const [appliedStatus, setAppliedStatus] = useState('')
  const debouncedSearch = useDebouncedValue(search)

  useEffect(() => {
    setTypeFilter(initialType)
    setAppliedType(initialType)
  }, [initialType])

  function load() {
    return api
      .getAlerts({
        orgIds: selectedOrgIds,
        limit: 80,
        type: diseaseOnly ? 'image' : undefined,
      })
      .then((result) => {
        setItems(result.items)
        setTotal(result.total)
      })
  }

  useEffect(() => {
    let alive = true
    setError('')
    load().catch((err) => {
      if (alive) setError(err.message)
    })
    return () => {
      alive = false
    }
  }, [selectedOrgIds, diseaseOnly])

  const fields = useMemo(() => {
    const map = new Map()
    items.forEach((alert) => {
      if (!map.has(alert.fieldId)) {
        map.set(alert.fieldId, {
          id: alert.fieldId,
          fieldName: alert.fieldName,
          orgName: alert.orgName,
          alerts: [],
        })
      }
      map.get(alert.fieldId).alerts.push(alert)
    })
    return [...map.values()].sort((a, b) => {
      const openA = a.alerts.filter((row) => row.status === 'open').length
      const openB = b.alerts.filter((row) => row.status === 'open').length
      if (openB !== openA) return openB - openA
      return a.fieldName.localeCompare(b.fieldName, 'vi')
    })
  }, [items])

  useEffect(() => {
    if (!fields.length) {
      setFieldId('')
      return
    }
    if (!fields.some((field) => field.id === fieldId)) setFieldId(fields[0].id)
  }, [fields, fieldId])

  const field = fields.find((row) => row.id === fieldId)
  const rows = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase()
    return (field?.alerts || []).filter((alert) => {
      if (appliedType && alert.type !== appliedType) return false
      if (appliedStatus && alert.status !== appliedStatus) return false
      if (!needle) return true
      return `${alert.title} ${alert.summary} ${ALERT_TYPE_LABEL[alert.type] || ''}`.toLowerCase().includes(needle)
    })
  }, [field, debouncedSearch, appliedType, appliedStatus])

  useEffect(() => {
    if (rows.length && !rows.some((row) => row.id === selectedId)) setSelectedId(rows[0].id)
  }, [rows, selectedId])

  const selected = rows.find((row) => row.id === selectedId) || rows[0]
  const orgNote =
    selectedOrgIds.length === 1
      ? organizations.find((org) => org.id === selectedOrgIds[0])?.name
      : `${organizations.length} đơn vị`

  async function handleSaved(payload) {
    await api.submitAlertFeedback(feedbackAlert.id, payload)
    setFeedbackAlert(null)
    await load()
  }

  const pageTitle = diseaseOnly ? FEATURES.D3_DISEASE.title : FEATURES.D3.title
  const pageDescription = diseaseOnly ? FEATURES.D3_DISEASE.description : FEATURES.D3.description

  return (
    <PageFrame
      code="D3"
      title={pageTitle}
      description={`${total} cảnh báo · ${orgNote}. ${pageDescription}`}
    >
      <FeatureMeta code="D3" />
      {error ? <p className="text-danger">{error}</p> : null}
      <MasterDetailLayout
        master={
          <MasterList title="Thửa ruộng" isEmpty={fields.length === 0}>
            {fields.map((item) => {
              const openCount = item.alerts.filter((row) => row.status === 'open').length
              const risk = worstRisk(item.alerts)
              return (
                <MasterItem
                  key={item.id}
                  active={fieldId === item.id}
                  onClick={() => setFieldId(item.id)}
                  title={item.fieldName}
                  subtitle={item.orgName}
                  meta={`${item.alerts.length} cảnh báo`}
                  badge={
                    <StatusPill tone={openCount ? RISK_TONE[risk] : 'success'}>
                      {openCount ? `${openCount} chưa phản hồi` : 'Đã xử lý'}
                    </StatusPill>
                  }
                />
              )
            })}
          </MasterList>
        }
        detail={
          <>
            <DetailHeader
              empty={!field}
              title={field?.fieldName}
              meta={field ? `${field.orgName} · ${field.alerts.length} cảnh báo` : ''}
              actions={
                selected?.status === 'open' ? (
                  <button type="button" className="btn btn-sm btn-rg" onClick={() => setFeedbackAlert(selected)}>
                    Phản hồi
                  </button>
                ) : null
              }
            />
            {field ? (
              <div className="rg-md-detail-body">
                <FilterActionBar
                  search={search}
                  onSearch={setSearch}
                  searchPlaceholder="Tìm tiêu đề, nội dung…"
                  filterValue={typeFilter}
                  onFilter={setTypeFilter}
                  filterOptions={
                    diseaseOnly
                      ? [{ value: 'image', label: 'Nhận diện từ ảnh nông dân' }]
                      : [
                          { value: '', label: 'Tất cả loại' },
                          { value: 'environment', label: 'Cảnh báo nguy cơ' },
                          { value: 'image', label: 'Nhận diện từ ảnh' },
                        ]
                  }
                  onApply={() => {
                    setAppliedType(typeFilter)
                    setAppliedStatus(statusFilter)
                  }}
                  resultCount={rows.length}
                  extra={
                    <select
                      className="form-select form-select-sm rg-md-filter"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      aria-label="Lọc trạng thái"
                    >
                      <option value="">Tất cả trạng thái</option>
                      {Object.entries(ALERT_STATUS_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  }
                />
                <DataTable
                  rows={rows}
                  selectedId={selected?.id}
                  onSelectRow={(row) => setSelectedId(row.id)}
                  columns={[
                    { key: 'title', header: 'Cảnh báo' },
                    {
                      key: 'type',
                      header: 'Loại',
                      render: (row) => (
                        <StatusPill tone={TYPE_TONE[row.type]}>{ALERT_TYPE_LABEL[row.type]}</StatusPill>
                      ),
                    },
                    {
                      key: 'riskLevel',
                      header: 'Mức rủi ro',
                      render: (row) => (
                        <StatusPill tone={RISK_TONE[row.riskLevel]}>{RISK_LABEL[row.riskLevel]}</StatusPill>
                      ),
                    },
                    {
                      key: 'status',
                      header: 'Trạng thái',
                      render: (row) => (
                        <StatusPill tone={STATUS_TONE[row.status]}>{ALERT_STATUS_LABEL[row.status]}</StatusPill>
                      ),
                    },
                    { key: 'createdAt', header: 'Thời điểm', render: (row) => formatWhen(row.createdAt) },
                    {
                      key: 'confidence',
                      header: 'Tin cậy',
                      render: () => METRIC_DASH,
                    },
                  ]}
                />
                {selected ? (
                  <div className="rg-md-panel">
                    <p className="mb-1">{selected.summary}</p>
                    {selected.treatmentTitle ? (
                      <div className="mt-2">
                        <p className="fw-semibold mb-1">
                          Phương án đã gửi: {selected.treatmentTitle}
                        </p>
                        <ol className="small mb-0 ps-3">
                          {(selected.treatmentActions || []).map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    {selected.feedbackReason ? (
                      <p className="small text-muted mb-0 mt-2">Lý do: {selected.feedbackReason}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        }
      />
      {feedbackAlert ? (
        <AlertFeedbackModal alert={feedbackAlert} onClose={() => setFeedbackAlert(null)} onSaved={handleSaved} />
      ) : null}
    </PageFrame>
  )
}
