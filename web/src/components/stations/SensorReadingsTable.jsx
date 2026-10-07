import { useMemo, useState } from 'react'
import { DataTable } from '../workspace/DataTable.jsx'
import { FilterActionBar } from '../workspace/FilterActionBar.jsx'
import { StatusPill } from '../workspace/StatusPill.jsx'
import { formatWhen } from '../workspace/format.js'
import {
  SENSOR_METRICS,
  formatMetricValue,
  formatThresholdLine,
  readingBreaches,
  worstBreachClass,
} from '../../constants/sensors.js'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'

const BREACH_TONE = { 'rg-risk-high': 'danger', 'rg-risk-medium': 'warning', 'rg-risk-low': 'success' }
const BREACH_LABEL = { 'rg-risk-high': 'Vượt ngưỡng', 'rg-risk-medium': 'Cận ngưỡng', 'rg-risk-low': 'Ổn định' }

export function SensorReadingsTable({ items, thresholds, showThresholds = true }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [appliedFilter, setAppliedFilter] = useState('')
  const debouncedSearch = useDebouncedValue(search)

  const rows = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase()
    return items
      .filter((row) => {
        if (appliedFilter === 'breach') return readingBreaches(row, thresholds)
        if (appliedFilter === 'ok') return !readingBreaches(row, thresholds)
        return true
      })
      .filter((row) => {
        if (!needle) return true
        const hay = `${formatWhen(row.recordedAt)} ${SENSOR_METRICS.map((metric) => row[metric.key]).join(' ')}`
        return hay.toLowerCase().includes(needle)
      })
  }, [items, thresholds, debouncedSearch, appliedFilter])

  return (
    <div>
      {showThresholds && thresholds ? <p className="small text-muted">{formatThresholdLine(thresholds)}</p> : null}
      <FilterActionBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Tìm theo thời điểm, chỉ số…"
        filterValue={filter}
        onFilter={setFilter}
        filterOptions={[
          { value: '', label: 'Tất cả bản ghi' },
          { value: 'breach', label: 'Vượt / cận ngưỡng' },
          { value: 'ok', label: 'Ổn định' },
        ]}
        onApply={() => setAppliedFilter(filter)}
        resultCount={rows.length}
      />
      <DataTable
        rows={rows}
        columns={[
          { key: 'recordedAt', header: 'Thời điểm', render: (row) => formatWhen(row.recordedAt) },
          ...SENSOR_METRICS.map((metric) => ({
            key: metric.key,
            header: metric.short,
            render: (row) => formatMetricValue(metric.key, row[metric.key]),
          })),
          {
            key: 'status',
            header: 'Trạng thái',
            render: (row) => {
              const cls = worstBreachClass(row, thresholds)
              return <StatusPill tone={BREACH_TONE[cls]}>{BREACH_LABEL[cls]}</StatusPill>
            },
          },
        ]}
      />
    </div>
  )
}
