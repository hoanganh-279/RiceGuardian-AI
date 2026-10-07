import { METRIC_DASH } from '../utils/metricDisplay.js'

export const SENSOR_METRICS = [
  { key: 'tempC', label: 'Nhiệt độ', unit: '°C', short: 'Nhiệt' },
  { key: 'humidityPct', label: 'Độ ẩm không khí', unit: '%', short: 'Ẩm KK' },
  { key: 'waterCm', label: 'Mực nước', unit: 'cm', short: 'Nước' },
  { key: 'lightLux', label: 'Ánh sáng', unit: 'lux', short: 'Sáng' },
  { key: 'soilMoisturePct', label: 'Độ ẩm đất', unit: '%', short: 'Ẩm đất' },
]

export function formatMetricValue(_key, _value) {
  return METRIC_DASH
}

export function formatThresholdLine(thresholds) {
  if (!thresholds) return ''
  return SENSOR_METRICS.map((metric) => `${metric.short} ${METRIC_DASH}`).join(' · ')
}

export function breachClass(value, min, max) {
  if (min == null || max == null || value == null) return 'rg-risk-low'
  if (value < min || value > max) return 'rg-risk-high'
  const span = max - min
  if (value > max - span * 0.15 || value < min + span * 0.15) return 'rg-risk-medium'
  return 'rg-risk-low'
}

export function worstBreachClass(row, thresholds) {
  if (!row || !thresholds) return 'rg-risk-low'
  const ranks = { 'rg-risk-high': 2, 'rg-risk-medium': 1, 'rg-risk-low': 0 }
  let worst = 'rg-risk-low'
  SENSOR_METRICS.forEach((metric) => {
    const band = thresholds[metric.key]
    const next = breachClass(row[metric.key], band?.min, band?.max)
    if (ranks[next] > ranks[worst]) worst = next
  })
  return worst
}

export function readingBreaches(row, thresholds) {
  if (!row || !thresholds) return false
  return SENSOR_METRICS.some((metric) => {
    const band = thresholds[metric.key]
    const value = row[metric.key]
    if (band == null || value == null) return false
    return value < band.min || value > band.max
  })
}

export function stationManagePath(role, stationId) {
  if (!stationId) return ''
  if (role === 'admin') return `/admin/devices/${stationId}`
  if (role === 'technician') return `/technician/stations/${stationId}`
  return ''
}

export function stationSensorsPath(role, stationId) {
  if (!stationId) return ''
  if (role === 'admin') return `/admin/devices/${stationId}?tab=sensors`
  if (role === 'technician') return `/technician/sensors?stationId=${encodeURIComponent(stationId)}`
  return ''
}

export function notificationKindLabel(kind) {
  if (kind === 'station_fault') return 'Trạm hư'
  if (kind === 'alert') return 'Cảnh báo'
  return 'Hệ thống'
}
