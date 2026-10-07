import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { DataTable } from '../../components/workspace/DataTable.jsx'
import { DetailHeader } from '../../components/workspace/DetailHeader.jsx'
import { FilterActionBar } from '../../components/workspace/FilterActionBar.jsx'
import { MasterDetailLayout } from '../../components/workspace/MasterDetailLayout.jsx'
import { MasterItem, MasterList } from '../../components/workspace/MasterList.jsx'
import { StatusPill } from '../../components/workspace/StatusPill.jsx'
import { formatWhen } from '../../components/workspace/format.js'
import { FEATURES } from '../../constants/features.js'
import { notificationKindLabel, stationManagePath } from '../../constants/sensors.js'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import { api } from '../../services/api.js'

const KIND_TONE = { station_fault: 'danger', alert: 'warning', system: 'info' }
const KIND_ORDER = ['alert', 'station_fault', 'system']

export default function NotificationsPage() {
  const { selectedOrgIds, organizations, isTechnician, user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [error, setError] = useState('')
  const [kind, setKind] = useState('alert')
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [appliedFilter, setAppliedFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const debouncedSearch = useDebouncedValue(search)

  function load() {
    return api.getNotifications({ orgIds: selectedOrgIds, limit: 50 }).then((result) => {
      setItems(result.items)
      setUnreadCount(result.unreadCount)
      return result.items
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
  }, [selectedOrgIds])

  const groups = useMemo(
    () =>
      KIND_ORDER.map((value) => {
        const rows = items.filter((row) => row.kind === value)
        return {
          id: value,
          label: notificationKindLabel(value),
          count: rows.length,
          unread: rows.filter((row) => !row.read).length,
        }
      }).filter((group) => group.count > 0),
    [items],
  )

  useEffect(() => {
    if (!groups.length) {
      setKind('')
      return
    }
    if (!groups.some((group) => group.id === kind)) setKind(groups[0].id)
  }, [groups, kind])

  const orgNote =
    selectedOrgIds.length === 1
      ? organizations.find((org) => org.id === selectedOrgIds[0])?.name
      : isTechnician
        ? `${organizations.length} đơn vị`
        : 'phạm vi của bạn'

  const group = groups.find((row) => row.id === kind)
  const rows = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase()
    return items.filter((row) => {
      if (row.kind !== kind) return false
      if (appliedFilter === 'unread' && row.read) return false
      if (appliedFilter === 'read' && !row.read) return false
      if (!needle) return true
      return `${row.title} ${row.body}`.toLowerCase().includes(needle)
    })
  }, [items, kind, debouncedSearch, appliedFilter])

  useEffect(() => {
    if (rows.length && !rows.some((row) => row.id === selectedId)) setSelectedId(rows[0].id)
  }, [rows, selectedId])

  const selected = rows.find((row) => row.id === selectedId) || rows[0]
  const managePath =
    selected?.kind === 'station_fault' && selected.stationId ? stationManagePath(user.role, selected.stationId) : ''

  async function markOne(id) {
    await api.markNotificationRead(id)
    await load()
  }

  async function markAll() {
    await api.markAllNotificationsRead(selectedOrgIds)
    await load()
  }

  async function openTarget(item) {
    if (!item.read) await api.markNotificationRead(item.id)
    await load()
    if (item.kind === 'station_fault' && item.stationId) {
      const path = stationManagePath(user.role, item.stationId)
      if (path) navigate(path)
    }
  }

  async function handleDelete(id) {
    await api.dismissNotification(id)
    setSelectedIds((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
    await load()
  }

  async function handleBatchDelete() {
    await Promise.all([...selectedIds].map((id) => api.dismissNotification(id)))
    setSelectedIds(new Set())
    await load()
  }

  return (
    <PageFrame
      code="E1"
      title={FEATURES.E1.title}
      description={`${unreadCount} chưa đọc · đang xem ${orgNote}. ${FEATURES.E1.description}`}
      actions={
        unreadCount > 0 ? (
          <button type="button" className="btn btn-rg-ghost" onClick={markAll}>
            Đánh dấu tất cả đã đọc
          </button>
        ) : null
      }
    >
      {error ? <p className="text-danger">{error}</p> : null}
      <MasterDetailLayout
        master={
          <MasterList title="Loại thông báo" isEmpty={groups.length === 0}>
            {groups.map((item) => (
              <MasterItem
                key={item.id}
                active={kind === item.id}
                onClick={() => {
                  setKind(item.id)
                  setSelectedIds(new Set())
                  setSearch('')
                  setFilter('')
                  setAppliedFilter('')
                }}
                title={item.label}
                meta={`${item.count} mục`}
                badge={
                  <StatusPill tone={item.unread ? KIND_TONE[item.id] : 'muted'}>
                    {item.unread ? `${item.unread} chưa đọc` : 'Đã đọc hết'}
                  </StatusPill>
                }
              />
            ))}
          </MasterList>
        }
        detail={
          <>
            <DetailHeader
              empty={!group}
              title={group?.label}
              meta={group ? `${group.count} thông báo · ${orgNote}` : ''}
              actions={
                selected ? (
                  <>
                    {selected.read ? null : (
                      <button type="button" className="btn btn-sm btn-rg-outline" onClick={() => markOne(selected.id)}>
                        Đánh dấu đã đọc
                      </button>
                    )}
                    {managePath ? (
                      <button type="button" className="btn btn-sm btn-rg" onClick={() => openTarget(selected)}>
                        Mở đối tượng
                      </button>
                    ) : null}
                    <button type="button" className="btn btn-sm btn-rg-danger" onClick={() => handleDelete(selected.id)}>
                      Xóa
                    </button>
                  </>
                ) : null
              }
            />
            {group ? (
              <div className="rg-md-detail-body">
                <FilterActionBar
                  search={search}
                  onSearch={setSearch}
                  searchPlaceholder="Tìm tiêu đề, nội dung…"
                  filterValue={filter}
                  onFilter={setFilter}
                  filterOptions={[
                    { value: '', label: 'Tất cả' },
                    { value: 'unread', label: 'Chưa đọc' },
                    { value: 'read', label: 'Đã đọc' },
                  ]}
                  onApply={() => setAppliedFilter(filter)}
                  resultCount={rows.length}
                  selectedCount={selectedIds.size}
                  onBatchDelete={handleBatchDelete}
                />
                <DataTable
                  rows={rows}
                  selectedId={selected?.id}
                  onSelectRow={(row) => setSelectedId(row.id)}
                  selectable
                  selectedIds={selectedIds}
                  onToggleRow={(id) => {
                    setSelectedIds((current) => {
                      const next = new Set(current)
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      return next
                    })
                  }}
                  onToggleAll={() => {
                    setSelectedIds((current) => {
                      if (rows.every((row) => current.has(row.id))) return new Set()
                      return new Set(rows.map((row) => row.id))
                    })
                  }}
                  onDeleteRow={(row) => handleDelete(row.id)}
                  columns={[
                    { key: 'title', header: 'Tiêu đề' },
                    { key: 'orgName', header: 'Đơn vị' },
                    { key: 'createdAt', header: 'Thời điểm', render: (row) => formatWhen(row.createdAt) },
                    {
                      key: 'read',
                      header: 'Trạng thái',
                      render: (row) => (
                        <StatusPill tone={row.read ? 'muted' : 'warning'}>{row.read ? 'Đã đọc' : 'Chưa đọc'}</StatusPill>
                      ),
                    },
                  ]}
                />
                {selected ? (
                  <div className="rg-md-panel">
                    <p className="mb-0">{selected.body}</p>
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
