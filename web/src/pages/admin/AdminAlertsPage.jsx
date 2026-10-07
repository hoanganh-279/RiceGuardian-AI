import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { DataTable } from '../../components/workspace/DataTable.jsx'
import { DetailHeader } from '../../components/workspace/DetailHeader.jsx'
import { FilterActionBar } from '../../components/workspace/FilterActionBar.jsx'
import { MasterDetailLayout } from '../../components/workspace/MasterDetailLayout.jsx'
import { MasterItem, MasterList } from '../../components/workspace/MasterList.jsx'
import { StatusPill } from '../../components/workspace/StatusPill.jsx'
import { formatWhen } from '../../components/workspace/format.js'
import { RISK_LABEL } from '../../constants/alerts.js'
import { FEATURES } from '../../constants/features.js'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'

const SOURCE_LABEL = {
  environment: 'Nguy cơ IoT',
  station_fault: 'Sự cố trạm',
  system: 'Hệ thống',
}

const SOURCE_TONE = {
  environment: 'warning',
  station_fault: 'danger',
  system: 'info',
}

const RISK_TONE = { high: 'danger', medium: 'warning', low: 'success' }

const KIND_ORDER = ['station_fault', 'environment', 'system']

export default function AdminAlertsPage() {
  const { selectedOrgIds, organizations } = useAuth()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [groupId, setGroupId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [appliedKind, setAppliedKind] = useState('')
  const debouncedSearch = useDebouncedValue(search)

  useEffect(() => {
    let alive = true
    setError('')
    api
      .getAdminOperationalAlerts({ orgIds: selectedOrgIds, limit: 80 })
      .then((result) => {
        if (!alive) return
        setItems(result.items)
        setTotal(result.total)
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [selectedOrgIds])

  const groups = useMemo(
    () =>
      KIND_ORDER.map((kind) => {
        const rows = items.filter((row) => row.sourceKind === kind)
        return {
          id: kind,
          label: SOURCE_LABEL[kind],
          count: rows.length,
          rows,
        }
      }).filter((group) => group.count > 0),
    [items],
  )

  useEffect(() => {
    if (!groups.length) {
      setGroupId('')
      return
    }
    if (!groups.some((group) => group.id === groupId)) setGroupId(groups[0].id)
  }, [groups, groupId])

  const group = groups.find((row) => row.id === groupId)
  const rows = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase()
    return (group?.rows || []).filter((row) => {
      if (appliedKind && row.sourceKind !== appliedKind) return false
      if (!needle) return true
      return `${row.title} ${row.body} ${row.orgName || ''}`.toLowerCase().includes(needle)
    })
  }, [group, debouncedSearch, appliedKind])

  useEffect(() => {
    if (rows.length && !rows.some((row) => row.id === selectedId)) setSelectedId(rows[0].id)
  }, [rows, selectedId])

  const selected = rows.find((row) => row.id === selectedId) || rows[0]
  const orgNote =
    selectedOrgIds.length === 1
      ? organizations.find((org) => org.id === selectedOrgIds[0])?.name
      : 'toàn hệ thống'

  return (
    <PageFrame
      code="B10"
      title={FEATURES.B10.title}
      description={`${total} mục · ${orgNote}. ${FEATURES.B10.description}`}
    >
      <FeatureMeta code="B10" />
      {error ? <p className="text-danger">{error}</p> : null}
      <MasterDetailLayout
        master={
          <MasterList title="Loại cảnh báo" isEmpty={groups.length === 0}>
            {groups.map((item) => (
              <MasterItem
                key={item.id}
                active={groupId === item.id}
                onClick={() => setGroupId(item.id)}
                title={item.label}
                meta={`${item.count} mục`}
                badge={<StatusPill tone={SOURCE_TONE[item.id]}>{item.count}</StatusPill>}
              />
            ))}
          </MasterList>
        }
        detail={
          <>
            <DetailHeader
              empty={!group}
              title={group?.label}
              meta={group ? `${group.count} cảnh báo vận hành` : ''}
              actions={
                selected?.sourceKind === 'environment' && selected.alertId ? (
                  <Link className="btn btn-sm btn-outline-secondary" to="/admin/devices">
                    Thiết bị IoT
                  </Link>
                ) : null
              }
            />
            {group ? (
              <div className="rg-md-detail-body">
                <FilterActionBar
                  search={search}
                  onSearch={setSearch}
                  searchPlaceholder="Tìm tiêu đề, nội dung…"
                  filterValue={kindFilter}
                  onFilter={setKindFilter}
                  filterOptions={[
                    { value: '', label: 'Tất cả loại' },
                    ...KIND_ORDER.map((value) => ({ value, label: SOURCE_LABEL[value] })),
                  ]}
                  onApply={() => setAppliedKind(kindFilter)}
                  resultCount={rows.length}
                />
                <DataTable
                  rows={rows}
                  selectedId={selected?.id}
                  onSelectRow={(row) => setSelectedId(row.id)}
                  columns={[
                    { key: 'title', header: 'Cảnh báo' },
                    {
                      key: 'sourceKind',
                      header: 'Loại',
                      render: (row) => (
                        <StatusPill tone={SOURCE_TONE[row.sourceKind]}>
                          {SOURCE_LABEL[row.sourceKind]}
                        </StatusPill>
                      ),
                    },
                    {
                      key: 'riskLevel',
                      header: 'Mức',
                      render: (row) => (
                        <StatusPill tone={RISK_TONE[row.riskLevel] || 'info'}>
                          {RISK_LABEL[row.riskLevel] || row.riskLevel}
                        </StatusPill>
                      ),
                    },
                    { key: 'orgName', header: 'Vùng / đơn vị' },
                    { key: 'createdAt', header: 'Thời điểm', render: (row) => formatWhen(row.createdAt) },
                  ]}
                />
                {selected ? (
                  <div className="rg-md-panel">
                    <p className="mb-1">{selected.body}</p>
                    {selected.fieldName ? (
                      <p className="small text-muted mb-0">Thửa: {selected.fieldName}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        }
      />
    </PageFrame>
  )
}
