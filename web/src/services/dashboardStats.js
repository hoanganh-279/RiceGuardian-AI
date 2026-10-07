import { METRIC_DASH } from '../utils/metricDisplay.js'

const VN_TZ = 'Asia/Ho_Chi_Minh'

export function dateKeyVn(value) {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatDayLabel(dateKey) {
  const [, month, day] = dateKey.split('-')
  return `${day}/${month}`
}

export function lastNDateKeys(count, from = new Date()) {
  const keys = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const point = new Date(from.getTime())
    point.setDate(point.getDate() - offset)
    keys.push(dateKeyVn(point))
  }
  return keys
}

/** UI-only: numeric KPIs are dashes; keep field/alert name frames. */
export function buildManagerDashboard({ fields, alerts, technicians }) {
  const dayKeys = lastNDateKeys(7)
  const fieldMeta = new Map(fields.map((field) => [field.id, field]))
  const openAlerts = alerts.filter((row) => row.status === 'open')
  const countsByField = new Map()
  openAlerts.forEach((row) => {
    countsByField.set(row.fieldId, (countsByField.get(row.fieldId) || 0) + 1)
  })
  const topFields = [...countsByField.entries()]
    .map(([fieldId]) => {
      const field = fieldMeta.get(fieldId)
      const sample = openAlerts.find((row) => row.fieldId === fieldId)
      return {
        id: fieldId,
        name: field?.name || sample?.fieldName || fieldId,
        orgName: field?.orgName || sample?.orgName || '',
        count: METRIC_DASH,
      }
    })
    .slice(0, 5)

  return {
    areaHa: METRIC_DASH,
    fieldCount: METRIC_DASH,
    alertFieldCount: METRIC_DASH,
    activeTechnicians: METRIC_DASH,
    alertAccuracyPct: METRIC_DASH,
    trend: dayKeys.map((key) => ({ key, label: formatDayLabel(key), value: 0 })),
    byRisk: { high: 0, medium: 0, low: 0 },
    topFields,
    _uiOnly: true,
  }
}

export function buildTechnicianDashboard({ fields, alerts, inspections, mapFeatures }) {
  const today = dateKeyVn(new Date())
  const todayInspections = inspections
    .filter((row) => row.status === 'open' && dateKeyVn(row.scheduledAt) === today)
    .slice(0, 5)
  return {
    openAlertsToday: METRIC_DASH,
    inspectionsToday: METRIC_DASH,
    todayInspections,
    fields,
    mapFeatures,
  }
}

export function buildAdminDashboard({ surveys, stations, alerts, orgNameById }) {
  const dayKeys = lastNDateKeys(7)
  const recentSurveys = [...surveys]
    .sort((a, b) => String(b.flownAt).localeCompare(String(a.flownAt)))
    .slice(0, 5)

  const surveysByOrg = new Map()
  surveys.forEach((row) => {
    surveysByOrg.set(row.orgId, (surveysByOrg.get(row.orgId) || 0) + 1)
  })
  const uavByRegion = [...surveysByOrg.entries()]
    .map(([orgId]) => ({
      id: orgId,
      name: orgNameById[orgId] || orgId,
      orgName: '',
      count: METRIC_DASH,
    }))
    .slice(0, 8)

  const offlineByOrg = new Map()
  stations.forEach((row) => {
    if (!row.online) offlineByOrg.set(row.orgId, (offlineByOrg.get(row.orgId) || 0) + 1)
  })
  const iotOfflineByRegion = [...offlineByOrg.entries()]
    .map(([orgId]) => ({
      id: orgId,
      name: orgNameById[orgId] || orgId,
      orgName: METRIC_DASH,
      count: METRIC_DASH,
    }))
    .slice(0, 8)

  return {
    openDiseaseAlerts: METRIC_DASH,
    offlineStations: METRIC_DASH,
    stationCount: METRIC_DASH,
    recentSurveyCount: METRIC_DASH,
    recentSurveys,
    uavTrend: dayKeys.map((key) => ({ key, label: formatDayLabel(key), value: 0 })),
    uavByRegion,
    iotOfflineByRegion,
    iotStatus: { high: 0, medium: 0, low: 0 },
  }
}

export function buildSystemHealth({ stations, now = Date.now() }) {
  const hourLabel = (offsetHours) => {
    const at = new Date(now - offsetHours * 60 * 60 * 1000)
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: VN_TZ,
      hour: '2-digit',
      minute: '2-digit',
    }).format(at)
  }

  return {
    iotOnline: METRIC_DASH,
    iotOffline: METRIC_DASH,
    appSyncPct: METRIC_DASH,
    latencyMs: METRIC_DASH,
    errorRatePct: METRIC_DASH,
    sampledAt: new Date(now).toISOString(),
    latencySeries: Array.from({ length: 12 }, (_, index) => ({
      label: hourLabel(11 - index),
      value: 0,
    })),
    uptimeSeries: Array.from({ length: 12 }, (_, index) => ({
      label: hourLabel(11 - index),
      value: 0,
    })),
    recentIncidents: [],
  }
}
