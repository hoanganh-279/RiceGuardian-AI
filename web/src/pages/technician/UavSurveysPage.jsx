import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { RgModal } from '../../components/layout/RgModal.jsx'
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
import { UAV_ASSET_TYPE_LABEL } from '../../data/mockUav.js'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import { api } from '../../services/api.js'

const STATUS_LABEL = {
  queued: 'Chờ xử lý',
  processing: 'Đang ghép ảnh',
  done: 'Xong',
}

const STATUS_TONE = {
  queued: 'muted',
  processing: 'warning',
  done: 'success',
}

export default function UavSurveysPage() {
  const { selectedOrgIds, organizations } = useAuth()
  const [searchParams] = useSearchParams()
  const surveyFromUrl = searchParams.get('survey')
  const [items, setItems] = useState([])
  const [assets, setAssets] = useState([])
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ orgId: '', name: '', coverageHa: '', note: '' })
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [appliedFilter, setAppliedFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const debouncedSearch = useDebouncedValue(search)

  function loadSurveys() {
    return api.getUavSurveys(selectedOrgIds).then((rows) => {
      setItems(rows)
      return rows
    })
  }

  useEffect(() => {
    let alive = true
    loadSurveys()
      .then((rows) => {
        if (!alive || !rows[0]) return
        if (surveyFromUrl && rows.some((row) => row.id === surveyFromUrl)) {
          setSelectedId(surveyFromUrl)
          return
        }
        if (!rows.some((row) => row.id === selectedId)) setSelectedId(rows[0].id)
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [selectedOrgIds, surveyFromUrl])

  useEffect(() => {
    const pending = items.find((row) => row.status !== 'done')
    if (!pending) return undefined
    const timer = setTimeout(() => {
      api.advanceUavSurvey(pending.id).then(loadSurveys)
    }, 2200)
    return () => clearTimeout(timer)
  }, [items])

  useEffect(() => {
    if (!selectedId) {
      setAssets([])
      return undefined
    }
    let alive = true
    api.getUavAssets(selectedId).then((rows) => {
      if (alive) setAssets(rows)
    })
    return () => {
      alive = false
    }
  }, [selectedId, items])

  const selected = items.find((row) => row.id === selectedId)
  const rows = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase()
    return assets.filter((row) => {
      if (appliedFilter && row.status !== appliedFilter) return false
      if (!needle) return true
      return `${row.name} ${row.fieldName} ${row.note} ${UAV_ASSET_TYPE_LABEL[row.type] || ''}`.toLowerCase().includes(needle)
    })
  }, [assets, debouncedSearch, appliedFilter])

  async function handleCreate(event) {
    event.preventDefault()
    const created = await api.createUavSurvey(form)
    setOpen(false)
    setForm({ orgId: '', name: '', coverageHa: '', note: '' })
    await loadSurveys()
    setSelectedId(created.id)
  }

  async function handleDeleteSurvey(id) {
    await api.deleteUavSurvey(id)
    setSelectedIds(new Set())
    const rowsNext = await loadSurveys()
    setSelectedId((current) => (current === id ? rowsNext[0]?.id || '' : current))
  }

  async function handleDeleteAsset(id) {
    await api.deleteUavAsset(id)
    setSelectedIds((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
    setAssets(await api.getUavAssets(selectedId))
  }

  async function handleBatchDelete() {
    await Promise.all([...selectedIds].map((id) => api.deleteUavAsset(id)))
    setSelectedIds(new Set())
    setAssets(await api.getUavAssets(selectedId))
  }

  return (
    <PageFrame code="D7" title={FEATURES.D7.title} description={FEATURES.D7.description}>
      <FeatureMeta code="D7" />
      {error ? <p className="text-danger">{error}</p> : null}
      <MasterDetailLayout
        master={
          <MasterList
            title="Đợt UAV"
            onAdd={() => {
              setForm((current) => ({ ...current, orgId: organizations[0]?.id || selectedOrgIds[0] || '' }))
              setOpen(true)
            }}
            isEmpty={items.length === 0}
          >
            {items.map((item) => (
              <MasterItem
                key={item.id}
                active={selectedId === item.id}
                onClick={() => {
                  setSelectedId(item.id)
                  setSelectedIds(new Set())
                  setSearch('')
                  setAppliedFilter('')
                  setFilter('')
                }}
                title={item.name}
                subtitle={item.orgName}
                meta={`${formatWhen(item.flownAt)} · ${item.coverageHa} ha`}
                badge={<StatusPill tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</StatusPill>}
              />
            ))}
          </MasterList>
        }
        detail={
          <>
            <DetailHeader
              empty={!selected}
              title={selected?.name}
              meta={selected ? `${selected.orgName} · ${formatWhen(selected.flownAt)} · ${selected.note}` : ''}
              actions={
                selected ? (
                  <button type="button" className="btn btn-sm btn-rg-danger" onClick={() => handleDeleteSurvey(selected.id)}>
                    Xóa đợt
                  </button>
                ) : null
              }
            />
            {selected ? (
              <div className="rg-md-detail-body">
                <FilterActionBar
                  search={search}
                  onSearch={setSearch}
                  searchPlaceholder="Tìm tệp, thửa, ghi chú…"
                  filterValue={filter}
                  onFilter={setFilter}
                  filterOptions={[
                    { value: '', label: 'Mọi trạng thái' },
                    { value: 'queued', label: 'Chờ xử lý' },
                    { value: 'processing', label: 'Đang ghép ảnh' },
                    { value: 'done', label: 'Xong' },
                  ]}
                  onApply={() => setAppliedFilter(filter)}
                  resultCount={rows.length}
                  selectedCount={selectedIds.size}
                  onBatchDelete={handleBatchDelete}
                />
                <DataTable
                  rows={rows}
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
                  onDeleteRow={(row) => handleDeleteAsset(row.id)}
                  columns={[
                    { key: 'name', header: 'Tệp / lớp ảnh' },
                    {
                      key: 'type',
                      header: 'Loại',
                      render: (row) => <StatusPill tone="info">{UAV_ASSET_TYPE_LABEL[row.type] || row.type}</StatusPill>,
                    },
                    { key: 'fieldName', header: 'Thửa' },
                    { key: 'coverageHa', header: 'Diện tích', render: (row) => `${row.coverageHa} ha` },
                    {
                      key: 'status',
                      header: 'Trạng thái',
                      render: (row) => <StatusPill tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</StatusPill>,
                    },
                    { key: 'note', header: 'Ghi chú' },
                  ]}
                />
              </div>
            ) : null}
          </>
        }
      />
      {open ? (
        <RgModal title="Thêm đợt UAV" onClose={() => setOpen(false)}>
          <form onSubmit={handleCreate}>
            <label className="form-label" htmlFor="uav-org">
              Đơn vị
            </label>
            <select
              id="uav-org"
              className="form-select mb-2"
              required
              value={form.orgId}
              onChange={(event) => setForm({ ...form, orgId: event.target.value })}
            >
              <option value="">Chọn đơn vị</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <label className="form-label" htmlFor="uav-name">
              Tên UAV / đợt bay
            </label>
            <input
              id="uav-name"
              className="form-control mb-2"
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <label className="form-label" htmlFor="uav-ha">
              Diện tích (ha)
            </label>
            <input
              id="uav-ha"
              className="form-control mb-2"
              type="number"
              min="0"
              step="0.1"
              required
              value={form.coverageHa}
              onChange={(event) => setForm({ ...form, coverageHa: event.target.value })}
            />
            <label className="form-label" htmlFor="uav-note">
              Ghi chú
            </label>
            <textarea
              id="uav-note"
              className="form-control mb-3"
              rows="2"
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
            <div className="d-flex gap-2 justify-content-end">
              <button type="button" className="btn btn-light" onClick={() => setOpen(false)}>
                Hủy
              </button>
              <button type="submit" className="btn btn-rg">
                Thêm
              </button>
            </div>
          </form>
        </RgModal>
      ) : null}
    </PageFrame>
  )
}
