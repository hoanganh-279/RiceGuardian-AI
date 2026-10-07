import { useEffect, useMemo, useState } from 'react'
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
import { LOG_TYPE_LABEL } from '../../data/mockFieldLogs.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import { api } from '../../services/api.js'
import { METRIC_DASH } from '../../utils/metricDisplay.js'

export default function FieldLogsPage() {
  const { selectedOrgIds } = useAuth()
  const [items, setItems] = useState([])
  const [fields, setFields] = useState([])
  const [fieldId, setFieldId] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ fieldId: '', type: 'irrigation', title: '', note: '' })
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [appliedFilter, setAppliedFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const debouncedSearch = useDebouncedValue(search)

  function load() {
    return Promise.all([
      api.getFieldLogs({ orgIds: selectedOrgIds, limit: 80 }),
      api.getAssignedFields(selectedOrgIds),
    ]).then(([logs, fieldRows]) => {
      setItems(logs.items)
      setFields(fieldRows)
      return fieldRows
    })
  }

  useEffect(() => {
    let alive = true
    load()
      .then((fieldRows) => {
        if (!alive) return
        if (fieldRows[0] && !fieldRows.some((row) => row.id === fieldId)) setFieldId(fieldRows[0].id)
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [selectedOrgIds])

  const field = fields.find((row) => row.id === fieldId)
  const rows = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase()
    return items
      .filter((row) => row.fieldId === fieldId)
      .filter((row) => !appliedFilter || row.type === appliedFilter)
      .filter((row) => {
        if (!needle) return true
        return `${row.title} ${row.note} ${LOG_TYPE_LABEL[row.type] || ''}`.toLowerCase().includes(needle)
      })
  }, [items, fieldId, debouncedSearch, appliedFilter])

  async function handleSave(event) {
    event.preventDefault()
    if (form.id) await api.updateFieldLog(form.id, form)
    else await api.createFieldLog(form)
    setOpen(false)
    setForm({ fieldId, type: 'irrigation', title: '', note: '' })
    await load()
  }

  async function handleDelete(id) {
    await api.deleteFieldLog(id)
    setSelectedIds((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
    await load()
  }

  async function handleBatchDelete() {
    await Promise.all([...selectedIds].map((id) => api.deleteFieldLog(id)))
    setSelectedIds(new Set())
    await load()
  }

  function openCreate() {
    setForm({ fieldId: fieldId || fields[0]?.id || '', type: 'irrigation', title: '', note: '' })
    setOpen(true)
  }

  return (
    <PageFrame code="D8" title={FEATURES.D8.title} description={FEATURES.D8.description}>
      <FeatureMeta code="D8" />
      {error ? <p className="text-danger">{error}</p> : null}
      <MasterDetailLayout
        master={
          <MasterList title="Thửa ruộng" onAdd={openCreate} isEmpty={fields.length === 0}>
            {fields.map((item) => {
              const count = items.filter((row) => row.fieldId === item.id).length
              return (
                <MasterItem
                  key={item.id}
                  active={fieldId === item.id}
                  onClick={() => setFieldId(item.id)}
                  title={item.name}
                  subtitle={item.orgName}
                  meta={`${item.variety || '—'} · ${METRIC_DASH} · ${count} nhật ký`}
                />
              )
            })}
          </MasterList>
        }
        detail={
          <>
            <DetailHeader
              empty={!field}
              title={field?.name}
              meta={field ? `${field.orgName} · ${field.variety || '—'} · ${METRIC_DASH}` : ''}
              actions={
                field ? (
                  <button type="button" className="btn btn-sm btn-rg" onClick={openCreate}>
                    Thêm nhật ký
                  </button>
                ) : null
              }
            />
            {field ? (
              <div className="rg-md-detail-body">
                <FilterActionBar
                  search={search}
                  onSearch={setSearch}
                  searchPlaceholder="Tìm tiêu đề, ghi chú…"
                  filterValue={filter}
                  onFilter={setFilter}
                  filterOptions={[
                    { value: '', label: 'Mọi loại' },
                    ...Object.entries(LOG_TYPE_LABEL).map(([value, label]) => ({ value, label })),
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
                  onDeleteRow={(row) => handleDelete(row.id)}
                  onEditRow={(row) => {
                    setForm({
                      id: row.id,
                      fieldId: row.fieldId,
                      type: row.type,
                      title: row.title,
                      note: row.note || '',
                    })
                    setOpen(true)
                  }}
                  columns={[
                    { key: 'title', header: 'Tiêu đề' },
                    {
                      key: 'type',
                      header: 'Loại',
                      render: (row) => <StatusPill tone="info">{LOG_TYPE_LABEL[row.type] || row.type}</StatusPill>,
                    },
                    { key: 'loggedAt', header: 'Thời điểm', render: (row) => formatWhen(row.loggedAt) },
                    { key: 'note', header: 'Ghi chú' },
                  ]}
                />
              </div>
            ) : null}
          </>
        }
      />
      {open ? (
        <RgModal title={form.id ? 'Sửa nhật ký đồng ruộng' : 'Nhật ký đồng ruộng'} onClose={() => setOpen(false)}>
          <form onSubmit={handleSave}>
            <label className="form-label" htmlFor="log-field">
              Thửa
            </label>
            <select
              id="log-field"
              className="form-select mb-2"
              required
              value={form.fieldId}
              onChange={(event) => setForm({ ...form, fieldId: event.target.value })}
            >
              <option value="">Chọn thửa</option>
              {fields.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.orgName} · {item.name}
                </option>
              ))}
            </select>
            <label className="form-label" htmlFor="log-type">
              Loại
            </label>
            <select
              id="log-type"
              className="form-select mb-2"
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value })}
            >
              {Object.entries(LOG_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="form-label" htmlFor="log-title">
              Tiêu đề
            </label>
            <input
              id="log-title"
              className="form-control mb-2"
              required
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
            <label className="form-label" htmlFor="log-note">
              Ghi chú
            </label>
            <textarea
              id="log-note"
              className="form-control mb-3"
              rows="3"
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
            <div className="d-flex gap-2 justify-content-end">
              <button type="button" className="btn btn-light" onClick={() => setOpen(false)}>
                Hủy
              </button>
              <button type="submit" className="btn btn-rg">
                Lưu
              </button>
            </div>
          </form>
        </RgModal>
      ) : null}
    </PageFrame>
  )
}
