import { useEffect, useMemo, useState } from 'react'
import { PhotoReviewPanel } from '../../components/photos/PhotoReviewPanel.jsx'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { DataTable } from '../../components/workspace/DataTable.jsx'
import { DetailHeader } from '../../components/workspace/DetailHeader.jsx'
import { FilterActionBar } from '../../components/workspace/FilterActionBar.jsx'
import { MasterDetailLayout } from '../../components/workspace/MasterDetailLayout.jsx'
import { MasterItem, MasterList } from '../../components/workspace/MasterList.jsx'
import { StatusPill } from '../../components/workspace/StatusPill.jsx'
import { formatWhen } from '../../components/workspace/format.js'
import { FEATURES } from '../../constants/features.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { withPhotoSolution } from '../../data/diseaseCatalog.js'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import { api } from '../../services/api.js'
import { METRIC_DASH } from '../../utils/metricDisplay.js'

function groupKey(photo) {
  return `${photo.fieldId}::${photo.farmerName}`
}

export default function PhotosPage() {
  const { selectedOrgIds } = useAuth()
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [groupId, setGroupId] = useState('')
  const [activeId, setActiveId] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [appliedFilter, setAppliedFilter] = useState('')
  const debouncedSearch = useDebouncedValue(search)

  function load() {
    return api.getFarmerPhotos({ orgIds: selectedOrgIds, reviewed: undefined, limit: 80 }).then((result) => {
      const next = result.items.map(withPhotoSolution)
      setItems(next)
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

  const groups = useMemo(() => {
    const map = new Map()
    items.forEach((photo) => {
      const id = groupKey(photo)
      if (!map.has(id)) {
        map.set(id, {
          id,
          fieldId: photo.fieldId,
          fieldName: photo.fieldName,
          farmerName: photo.farmerName,
          orgName: photo.orgName,
          photos: [],
        })
      }
      map.get(id).photos.push(photo)
    })
    return [...map.values()]
  }, [items])

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
    return (group?.photos || []).filter((photo) => {
      if (appliedFilter === 'pending') return !photo.reviewed
      if (appliedFilter === 'reviewed') return photo.reviewed
      return true
    }).filter((photo) => {
      if (!needle) return true
      const hay = `${photo.disease} ${photo.farmerName} ${formatWhen(photo.capturedAt)}`
      return hay.toLowerCase().includes(needle)
    })
  }, [group, debouncedSearch, appliedFilter])

  const active = rows.find((row) => row.id === activeId) || items.find((row) => row.id === activeId)

  useEffect(() => {
    if (rows.length && !rows.some((row) => row.id === activeId)) setActiveId(rows[0].id)
  }, [rows, activeId])

  async function handleRescan() {
    const updated = withPhotoSolution(await api.rescanFarmerPhoto(active.id))
    setItems((current) => current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)))
  }

  async function handleReview() {
    const updated = withPhotoSolution(await api.markPhotoReviewed(active.id))
    setItems((current) => current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)))
  }

  return (
    <PageFrame code="D6" title={FEATURES.D6.title} description={FEATURES.D6.description}>
      <FeatureMeta code="D6" />
      {error ? <p className="text-danger">{error}</p> : null}
      <MasterDetailLayout
        master={
          <MasterList title="Thửa & nông dân" isEmpty={groups.length === 0}>
            {groups.map((item) => {
              const pending = item.photos.filter((photo) => !photo.reviewed).length
              return (
                <MasterItem
                  key={item.id}
                  active={groupId === item.id}
                  onClick={() => {
                    setGroupId(item.id)
                    setActiveId(item.photos[0]?.id || '')
                  }}
                  title={item.fieldName}
                  subtitle={item.farmerName}
                  meta={`${item.orgName} · ${item.photos.length} ảnh`}
                  badge={
                    <StatusPill tone={pending ? 'warning' : 'success'}>
                      {pending ? `${pending} chưa xem` : 'Đã xem hết'}
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
              empty={!group}
              title={group ? group.fieldName : ''}
              meta={group ? `${group.farmerName} · ${group.orgName}` : ''}
              actions={
                active && !active.reviewed ? (
                  <button type="button" className="btn btn-sm btn-rg" onClick={handleReview}>
                    Xác nhận đã xem xét
                  </button>
                ) : null
              }
            />
            {group ? (
              <div className="rg-md-detail-body">
                <FilterActionBar
                  search={search}
                  onSearch={setSearch}
                  searchPlaceholder="Tìm bệnh, thời điểm…"
                  filterValue={filter}
                  onFilter={setFilter}
                  filterOptions={[
                    { value: '', label: 'Tất cả ảnh' },
                    { value: 'pending', label: 'Chưa xem xét' },
                    { value: 'reviewed', label: 'Đã xem xét' },
                  ]}
                  onApply={() => setAppliedFilter(filter)}
                  resultCount={rows.length}
                />
                <DataTable
                  rows={rows}
                  selectedId={activeId}
                  onSelectRow={(row) => setActiveId(row.id)}
                  columns={[
                    {
                      key: 'thumb',
                      header: 'Ảnh',
                      render: (row) =>
                        row.imageUrl ? (
                          <img src={row.imageUrl} alt="" width="48" height="36" style={{ objectFit: 'cover', borderRadius: 4 }} />
                        ) : (
                          '—'
                        ),
                    },
                    { key: 'disease', header: 'Nhận diện' },
                    {
                      key: 'confidence',
                      header: 'Tin cậy',
                      render: () => METRIC_DASH,
                    },
                    { key: 'capturedAt', header: 'Thời điểm', render: (row) => formatWhen(row.capturedAt) },
                    {
                      key: 'reviewed',
                      header: 'Trạng thái',
                      render: (row) => (
                        <StatusPill tone={row.reviewed ? 'success' : 'warning'}>
                          {row.reviewed ? 'Đã xem xét' : 'Chưa xem xét'}
                        </StatusPill>
                      ),
                    },
                  ]}
                />
                {active ? <PhotoReviewPanel photo={active} onRescan={handleRescan} onReview={handleReview} /> : null}
              </div>
            ) : null}
          </>
        }
      />
    </PageFrame>
  )
}
