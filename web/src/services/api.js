import { ALERTS } from '../data/mockAlerts.js'
import { AUDIT_LOGS } from '../data/mockAudit.js'
import { FARMERS } from '../data/mockFarmers.js'
import { FIELD_LOGS } from '../data/mockFieldLogs.js'
import { INSPECTIONS } from '../data/mockInspections.js'
import { MAP_FEATURES } from '../data/mockMap.js'
import { NOTIFICATIONS } from '../data/mockNotifications.js'
import { PHOTOS } from '../data/mockPhotos.js'
import { DISEASE_CATALOG, getDisease, namesMatch, solutionFor, withPhotoSolution } from '../data/diseaseCatalog.js'
import { SEASONS, TECHNICIANS } from '../data/mockStaff.js'
import { SENSOR_METRICS, readingBreaches } from '../constants/sensors.js'
import { SENSOR_READINGS, STATION_ALERTS, STATIONS, THRESHOLDS } from '../data/mockStations.js'
import { UAV_ASSETS, UAV_SURVEYS } from '../data/mockUav.js'
import { FIELDS, ORGANIZATIONS, USERS, DEMO_PASSWORD } from '../data/mockUsers.js'
import { LEGACY_ORG_IDS, NAME_TO_ORG_ID, ORG_NAME, withOrgName } from '../data/orgIds.js'
import {
  clearSession,
  getSession,
  getToken,
  setSession,
} from './authStorage.js'
import {
  buildAdminDashboard,
  buildManagerDashboard,
  buildSystemHealth,
  buildTechnicianDashboard,
} from './dashboardStats.js'
import { METRIC_DASH } from '../utils/metricDisplay.js'

/** UI-only mock unless VITE_LIVE_API=1 or VITE_API_URL is set. */
const API_BASE = import.meta.env.VITE_API_URL || ''
const UI_ONLY = import.meta.env.VITE_LIVE_API !== '1' && !API_BASE
const RISK_ORDER = { high: 0, medium: 1, low: 2 }
const DEMO_TOKEN = 'rg_demo_ui_only'

/** Rewrite absolute local upload URLs so Vite proxy keeps them same-origin (avoids tainted canvas). */
export function normalizeUploadUrl(url) {
  if (!url || typeof url !== 'string') return url
  try {
    if (url.startsWith('/uploads/')) return url
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    if (!parsed.pathname.startsWith('/uploads/')) return url
    const host = parsed.hostname
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      (typeof window !== 'undefined' && host === window.location.hostname)
    if (!isLocal) return url
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return url
  }
}

function withNormalizedCover(field) {
  if (!field || typeof field !== 'object') return field
  const coverUrl = normalizeUploadUrl(field.coverUrl || field.coverImageUrl || null)
  return {
    ...field,
    coverUrl,
    coverImageUrl: coverUrl,
    coverMsUrl: normalizeUploadUrl(field.coverMsUrl || null),
    blbMaskUrl: normalizeUploadUrl(field.blbMaskUrl || null),
  }
}

function liveOrgQuery(orgIds) {
  const session = requireAuth()
  const params = new URLSearchParams()
  let ids = Array.isArray(orgIds) ? orgIds.filter(Boolean) : []
  if (!ids.length && session.user?.role !== 'admin') {
    ids = (session.organizations || []).map((org) => org.id)
  }
  for (const id of ids) params.append('orgId', id)
  const q = params.toString()
  return q ? `?${q}` : ''
}

async function liveFieldBoard(orgIds) {
  const data = await request(`/api/technician/fields${liveOrgQuery(orgIds)}`)
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
  return items.map(withNormalizedCover)
}

const SETTINGS_KEY = 'rg_settings_v1'
const DEFAULT_SETTINGS = {
  language: 'vi',
  timezone: 'Asia/Ho_Chi_Minh',
  notifyAlerts: true,
  notifySystem: true,
  maintenanceMode: false,
  allowNewOrgs: true,
}
const delay = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms))

let alertStore = ALERTS.map((row) => ({ ...row }))
let notificationStore = NOTIFICATIONS.map((row) => ({ ...row }))
const MAP_POINTS = Object.fromEntries(MAP_FEATURES.map((row) => [row.id, row.points]))
let fieldStore = FIELDS.map((row) => ({
  ...row,
  points: MAP_POINTS[row.id] || '',
  coverImageUrl: null,
  coverFileName: null,
  coverOutline: null,
}))
let stationStore = STATIONS.map((row) => ({ ...row }))
let sensorReadingStore = SENSOR_READINGS.map((row) => ({ ...row }))
let stationAlertStore = STATION_ALERTS.map((row) => ({ ...row }))
let photoStore = PHOTOS.map((row) => ({ ...row }))
let uavStore = UAV_SURVEYS.map((row) => ({ ...row }))
let uavAssetStore = UAV_ASSETS.map((row) => ({ ...row }))
let logStore = FIELD_LOGS.map((row) => ({ ...row }))
let inspectionStore = INSPECTIONS.map((row) => ({ ...row }))
let farmerStore = FARMERS.map((row) => ({ ...row }))
let technicianStore = TECHNICIANS.map((row) => ({ ...row }))
let orgStore = [
  ...ORGANIZATIONS.map((row) => ({ ...row, status: 'active' })),
  {
    id: '11111111-1111-4111-8111-111111111099',
    name: 'HTX Đăng ký mới (chờ duyệt)',
    fieldCount: 0,
    unreadAlerts: 0,
    unreadNotifications: 0,
    status: 'pending',
  },
]
let userStore = USERS.map((row) => ({ ...row }))
let auditStore = AUDIT_LOGS.map((row) => ({ ...row }))
let articleStore = []
let articleQuestionStore = []
let aiConfig = {
  applied: { ...THRESHOLDS },
  staging: { ...THRESHOLDS },
  appliedAt: '2026-08-10T08:00:00+07:00',
}
const trainingQueue = ALERTS.filter((row) => row.status === 'confirmed' || row.status === 'incorrect').map(
  (row) => ({
    id: `train_${row.id}`,
    alertId: row.id,
    orgId: row.orgId,
    fieldName: row.fieldName,
    status: row.status,
    reason: row.feedbackReason,
    photoName: row.photoName,
    approved: false,
    queuedAt: row.createdAt,
  }),
)
const mockListeners = new Set()

function bumpMockStore() {
  mockListeners.forEach((fn) => fn())
}

export function subscribeMockStore(fn) {
  mockListeners.add(fn)
  return () => mockListeners.delete(fn)
}

function paginate(rows, page = 1, limit = 20) {
  const currentPage = Math.max(1, Number(page) || 1)
  const pageSize = Math.max(1, Number(limit) || 20)
  const start = (currentPage - 1) * pageSize
  return {
    items: rows.slice(start, start + pageSize),
    page: currentPage,
    limit: pageSize,
    total: rows.length,
  }
}

function filterByOrgs(rows, orgIds) {
  if (!orgIds) return rows
  const allowed = new Set(orgIds)
  return rows.filter((row) => allowed.has(row.orgId))
}

function mockOrgId(org) {
  return NAME_TO_ORG_ID[org.name] || org.id
}

function enrichOrganizations(orgs) {
  return (orgs || []).map((org) => {
    const mock = ORGANIZATIONS.find((row) => row.name === org.name || row.id === org.id)
    if (!mock) {
      return {
        ...org,
        fieldCount: METRIC_DASH,
        unreadAlerts: METRIC_DASH,
        unreadNotifications: METRIC_DASH,
      }
    }
    return {
      ...org,
      id: org.id || mock.id,
      name: org.name || mock.name,
      fieldCount: METRIC_DASH,
      unreadAlerts: METRIC_DASH,
      unreadNotifications: METRIC_DASH,
    }
  })
}

function orgsForUser(user) {
  if (user.role === 'admin') {
    return enrichOrganizations(ORGANIZATIONS.map((row) => ({ id: row.id, name: row.name })))
  }
  return enrichOrganizations(
    ORGANIZATIONS.filter((row) => (user.organizationIds || []).includes(row.id)).map((row) => ({
      id: row.id,
      name: row.name,
    })),
  )
}

function publicUser(row) {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    role: row.role,
  }
}

function scopedOrgIds(orgIds) {
  const session = requireAuth()
  if (session.user.role === 'admin') return null
  const flaskToMock = new Map(session.organizations.map((org) => [org.id, mockOrgId(org)]))
  const known = new Set(session.organizations.map((org) => org.id))
  const requested = (orgIds || []).filter((id) => known.has(id) || LEGACY_ORG_IDS[id])
  const source = requested.length ? requested : session.organizations.map((org) => org.id)
  return [...new Set(source.map((id) => flaskToMock.get(id) || LEGACY_ORG_IDS[id] || id))]
}

const cache = new Map()

function cacheGet(key) {
  return cache.get(key)
}

function cacheSet(key, value) {
  cache.set(key, value)
  return value
}

function cacheInvalidate(prefix = '') {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

function requireAdmin() {
  const session = requireAuth()
  if (session.user.role !== 'admin') {
    const error = new Error('Chỉ Admin được thao tác mục này.')
    error.status = 403
    throw error
  }
  return session
}

function sessionOrgScope() {
  return scopedOrgIds()
}

function assertOrgAccess(orgId) {
  const scoped = sessionOrgScope()
  if (scoped && !scoped.includes(orgId)) {
    const error = new Error('Không có quyền trên đơn vị này.')
    error.status = 403
    throw error
  }
}

function latestReading(stationId) {
  const rows = sensorReadingStore.filter((row) => row.stationId === stationId)
  if (!rows.length) return null
  return [...rows].sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt)))[0]
}

function withStationExtras(station) {
  return withOrgName({ ...station, latest: latestReading(station.id) })
}

function findAccessibleStation(id) {
  const station = stationStore.find((row) => row.id === id)
  if (!station) {
    const error = new Error('Không tìm thấy trạm.')
    error.status = 404
    throw error
  }
  assertOrgAccess(station.orgId)
  return station
}

function pushStationNotifications(station, { title, body, kind = 'station_fault' }) {
  const now = new Date().toISOString()
  const stamp = Date.now()
  notificationStore.unshift({
    id: `ntf_${stamp}`,
    orgId: station.orgId,
    stationId: station.id,
    alertId: null,
    kind,
    title,
    body,
    createdAt: now,
    read: false,
    audience: 'web',
  })
  notificationStore.unshift({
    id: `ntf_farmer_${stamp}`,
    orgId: station.orgId,
    stationId: station.id,
    alertId: null,
    kind,
    title,
    body,
    createdAt: now,
    read: false,
    audience: 'farmer',
  })
  cacheInvalidate('notifications')
}

function appendAudit(action, target, detail) {
  const session = getSession()
  auditStore.unshift({
    id: `aud_${Date.now()}`,
    at: new Date().toISOString(),
    actor: session?.user?.fullName || 'Hệ thống',
    action,
    target,
    detail,
  })
  cacheInvalidate('audit')
}

function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function searchHref(type, extra = {}) {
  const role = getSession()?.user?.role
  if (type === 'field') {
    if (extra.id) {
      if (role === 'manager') return `/manager/fields/${extra.id}`
      return `/technician/fields/${extra.id}`
    }
    if (role === 'manager') return '/manager/fields'
    return '/technician/map'
  }
  if (type === 'alert') {
    if (role === 'manager') return '/manager'
    return '/technician/alerts'
  }
  if (type === 'farmer') return '/manager/farmers'
  if (type === 'station') {
    if (role === 'admin') return extra.id ? `/admin/devices/${extra.id}` : '/admin/devices'
    if (extra.fieldId) return `/technician/fields/${extra.fieldId}`
    return '/technician/map'
  }
  return '/'
}

async function parseApiResponse(response) {
  let data = null
  const text = await response.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: text }
    }
  }

  if (!response.ok) {
    const error = new Error(data?.error || 'Yêu cầu thất bại.')
    error.status = response.status
    throw error
  }

  return data
}

async function request(_path, _options = {}) {
  if (UI_ONLY) {
    const error = new Error('UI-only')
    error.status = 503
    throw error
  }
  const headers = {
    'Content-Type': 'application/json',
    ...(_options.headers || {}),
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE}${_path}`, {
      ..._options,
      headers,
    })
  } catch {
    throw new Error('Không kết nối được API.')
  }

  return parseApiResponse(response)
}

async function requestForm(_path, _formData, _method = 'POST') {
  if (UI_ONLY) {
    const error = new Error('UI-only')
    error.status = 503
    throw error
  }
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE}${_path}`, {
      method: _method,
      headers,
      body: _formData,
    })
  } catch {
    throw new Error('Không kết nối được API.')
  }

  return parseApiResponse(response)
}

function requireAuth() {
  const token = getToken()
  const session = getSession()
  if (!token || !session?.user) {
    const error = new Error('Chưa đăng nhập.')
    error.status = 401
    throw error
  }
  return session
}

function farmersForField(fieldId) {
  return farmerStore.filter((row) => (row.fieldIds || []).includes(fieldId))
}

function farmerLabelFor(farmers) {
  const withApp = farmers.filter((row) => row.appAccount)
  const source = withApp.length ? withApp : farmers
  if (!source.length) return 'Chưa gắn hộ'
  return source.map((row) => row.fullName).join(', ')
}

function uavCoverForField(fieldId) {
  const flownAt = Object.fromEntries(uavStore.map((row) => [row.id, row.flownAt || '']))
  return uavAssetStore
    .filter((row) => row.fieldId === fieldId && row.type === 'rgb' && row.status === 'done' && row.previewUrl)
    .sort((a, b) => String(flownAt[b.surveyId] || '').localeCompare(String(flownAt[a.surveyId] || '')))[0] || null
}

function withFieldBoard(field) {
  const farmers = farmersForField(field.id).map((row) => ({
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    appAccount: Boolean(row.appAccount),
  }))
  const stationRow = stationStore.find((row) => row.fieldId === field.id)
  let coverUrl = normalizeUploadUrl(field.coverImageUrl || null)
  let coverSource = 'none'
  if (coverUrl) {
    coverSource = 'upload'
  } else {
    const uav = uavCoverForField(field.id)
    if (uav) {
      coverUrl = normalizeUploadUrl(uav.previewUrl)
      coverSource = 'uav'
    }
  }
  return withOrgName({
    ...field,
    farmers,
    farmerLabel: farmerLabelFor(farmers),
    station: stationRow ? withStationExtras(stationRow) : null,
    coverUrl,
    coverSource,
    coverOutline: field.coverOutline || null,
  })
}

function fieldBoardFromFields(scoped) {
  return filterByOrgs(fieldStore, scoped)
    .map(withFieldBoard)
    .sort((a, b) => RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel] || a.name.localeCompare(b.name, 'vi'))
}

function stationOnField(fieldId, exceptId) {
  return stationStore.find((row) => row.fieldId === fieldId && row.id !== exceptId) || null
}

function bumpOrgFieldCount(orgId, delta) {
  const org = orgStore.find((row) => row.id === orgId)
  if (org) org.fieldCount = Math.max(0, (Number(org.fieldCount) || 0) + delta)
}

function syncFarmerFieldNames(farmer) {
  farmer.fieldNames = (farmer.fieldIds || [])
    .map((id) => fieldStore.find((row) => row.id === id)?.name)
    .filter(Boolean)
}

function applyFieldFarmers(fieldId, farmerIds) {
  const field = fieldStore.find((row) => row.id === fieldId)
  if (!field) return
  const wanted = new Set(farmerIds || [])
  farmerStore.forEach((farmer) => {
    if (farmer.orgId !== field.orgId) return
    const has = (farmer.fieldIds || []).includes(fieldId)
    const should = wanted.has(farmer.id)
    if (should && !has) farmer.fieldIds = [...(farmer.fieldIds || []), fieldId]
    if (!should && has) farmer.fieldIds = farmer.fieldIds.filter((id) => id !== fieldId)
    syncFarmerFieldNames(farmer)
  })
}

function parseLatLng(value) {
  if (value === '' || value == null) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export const api = {
  async login({ identifier, password }) {
    if (!UI_ONLY) {
      const payload = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      })
      setSession(payload.access_token, {
        user: payload.user,
        organizations: payload.organizations || [],
      })
      cacheInvalidate()
      return payload
    }
    await delay(120)
    const key = String(identifier || '').trim().toLowerCase()
    const user = USERS.find(
      (row) => row.email.toLowerCase() === key || row.phone === String(identifier || '').trim(),
    )
    if (!user || password !== user.password) {
      const error = new Error('Sai email/SĐT hoặc mật khẩu.')
      error.status = 401
      throw error
    }
    const organizations = orgsForUser(user)
    const payload = {
      access_token: DEMO_TOKEN,
      user: publicUser(user),
      organizations,
    }
    setSession(payload.access_token, {
      user: payload.user,
      organizations,
    })
    cacheInvalidate()
    return payload
  },

  async logout() {
    clearSession()
    cacheInvalidate()
    return { ok: true }
  },

  async getProfile() {
    const key = 'profile'
    const hit = cacheGet(key)
    if (hit) return hit
    const session = requireAuth()
    const next = {
      user: session.user,
      organizations: enrichOrganizations(session.organizations),
    }
    return cacheSet(key, next)
  },

  async updateProfile(patch) {
    const session = requireAuth()
    const nextUser = { ...session.user, ...patch }
    setSession(getToken() || DEMO_TOKEN, { ...session, user: nextUser })
    cacheInvalidate('profile')
    return nextUser
  },

  async changePassword({ oldPassword, newPassword }) {
    const session = requireAuth()
    const row = USERS.find((item) => item.id === session.user.id)
    if (!row || oldPassword !== row.password) {
      throw new Error('Mật khẩu cũ không đúng.')
    }
    if (!String(newPassword || '').trim() || String(newPassword).length < 6) {
      throw new Error('Mật khẩu mới không hợp lệ.')
    }
    row.password = newPassword
    return { ok: true }
  },

  async getMyOrganizations() {
    const key = 'orgs'
    const hit = cacheGet(key)
    if (hit) return hit
    const session = requireAuth()
    return cacheSet(key, enrichOrganizations(session.organizations))
  },

  async getManagerDashboard(orgIds) {
    requireAuth()
    const scoped = scopedOrgIds(orgIds)
    await delay(160)
    const fields = filterByOrgs(fieldStore, scoped).map(withOrgName)
    const alerts = filterByOrgs(alertStore, scoped).map(withOrgName)
    const technicians = technicianStore.filter(
      (row) => !scoped || row.orgIds.some((id) => scoped.includes(id)),
    )
    return buildManagerDashboard({ fields, alerts, technicians })
  },

  async getTechnicianDashboard(orgIds) {
    requireAuth()
    const scoped = scopedOrgIds(orgIds)
    await delay(160)
    const fields = fieldBoardFromFields(scoped)
    const alerts = filterByOrgs(alertStore, scoped).map(withOrgName)
    const inspections = filterByOrgs(inspectionStore, scoped)
      .map(withOrgName)
      .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)))
    return buildTechnicianDashboard({ fields, alerts, inspections, mapFeatures: fields.slice(0, 6) })
  },

  async getAdminDashboard(orgIds) {
    const session = requireAuth()
    if (session.user.role !== 'admin') {
      throw new Error('Chỉ Admin được xem dashboard hệ thống.')
    }
    const scoped = scopedOrgIds(orgIds)
    await delay(160)
    const surveys = filterByOrgs(UAV_SURVEYS, scoped).map(withOrgName)
    const stations = filterByOrgs(stationStore, scoped).map(withOrgName)
    const alerts = filterByOrgs(alertStore, scoped).map(withOrgName)
    return buildAdminDashboard({
      surveys,
      stations,
      alerts,
      orgNameById: ORG_NAME,
    })
  },

  async getAdminOperationalAlerts({ orgIds, page = 1, limit = 50 } = {}) {
    const session = requireAuth()
    if (session.user.role !== 'admin') {
      throw new Error('Chỉ Admin được xem cảnh báo vận hành.')
    }
    const scoped = scopedOrgIds(orgIds)
    await delay()
    const envAlerts = filterByOrgs(alertStore, scoped)
      .filter((row) => row.type === 'environment')
      .map((row) =>
        withOrgName({
          id: `env_${row.id}`,
          sourceKind: 'environment',
          title: row.title,
          body: row.summary,
          createdAt: row.createdAt,
          orgId: row.orgId,
          riskLevel: row.riskLevel,
          status: row.status,
          fieldName: row.fieldName,
          alertId: row.id,
        }),
      )
    const opsNotifications = filterByOrgs(notificationStore, scoped)
      .filter((row) => row.kind === 'station_fault' || row.kind === 'system')
      .map((row) =>
        withOrgName({
          id: `ntf_${row.id}`,
          sourceKind: row.kind,
          title: row.title,
          body: row.body,
          createdAt: row.createdAt,
          orgId: row.orgId,
          riskLevel: row.kind === 'station_fault' ? 'high' : 'medium',
          status: row.read ? 'read' : 'open',
          fieldName: null,
          alertId: row.alertId,
          notificationId: row.id,
        }),
      )
    const rows = [...envAlerts, ...opsNotifications].sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt)),
    )
    return paginate(rows, page, limit)
  },

  async getAssignedFields(orgIds) {
    if (!UI_ONLY) {
      const rows = await liveFieldBoard(orgIds)
      return rows
    }
    const scoped = scopedOrgIds(orgIds)
    const key = `fields:${(scoped || ['all']).join(',')}`
    const hit = cacheGet(key)
    if (hit) return hit
    await delay()
    const rows = fieldBoardFromFields(scoped)
    return cacheSet(key, rows)
  },

  async getAlerts({ orgIds, type, status, page = 1, limit = 20 } = {}) {
    const scoped = scopedOrgIds(orgIds)
    const key = `alerts:${(scoped || ['all']).join(',')}:${type || ''}:${status || ''}:${page}:${limit}`
    const hit = cacheGet(key)
    if (hit) return hit
    await delay()
    let rows = filterByOrgs(alertStore, scoped).map(withOrgName)
    if (type) rows = rows.filter((row) => row.type === type)
    if (status) rows = rows.filter((row) => row.status === status)
    rows = [...rows].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    return cacheSet(key, paginate(rows, page, limit))
  },

  async submitAlertFeedback(alertId, { status, reason, photoName, diseaseCode, actions } = {}) {
    requireAuth()
    if (!['confirmed', 'incorrect', 'watch'].includes(status)) {
      throw new Error('Trạng thái phản hồi không hợp lệ.')
    }
    if (status === 'incorrect' && !String(reason || '').trim()) {
      throw new Error('Cần nhập lý do khi chọn Sai.')
    }
    await delay(120)
    const alert = alertStore.find((row) => row.id === alertId)
    if (!alert) {
      const error = new Error('Không tìm thấy cảnh báo.')
      error.status = 404
      throw error
    }
    assertOrgAccess(alert.orgId)
    alert.status = status
    alert.feedbackReason = reason || null
    alert.photoName = photoName || alert.photoName
    if (diseaseCode) alert.diseaseCode = diseaseCode
    if (actions) alert.actions = actions
    cacheInvalidate('alerts')
    cacheInvalidate('fields')
    cacheInvalidate('training')
    cacheInvalidate('disease-plans')
    bumpMockStore()
    return withOrgName({ ...alert })
  },

  async getDiseasePlans() {
    requireAuth()
    const key = 'disease-plans'
    const hit = cacheGet(key)
    if (hit) return hit
    await delay(80)
    return cacheSet(key, {
      items: DISEASE_CATALOG.map((row) => ({ ...row, actions: [...row.actions] })),
    })
  },

  async appendDiseasePlanActions(updates) {
    requireAuth()
    await delay(80)
    cacheInvalidate('disease-plans')
    return { added: 0, skippedDup: 0, updates: updates || {} }
  },

  async getNotifications({ orgIds, page = 1, limit = 20 } = {}) {
    const scoped = scopedOrgIds(orgIds)
    const key = `notifications:${(scoped || ['all']).join(',')}:${page}:${limit}`
    const hit = cacheGet(key)
    if (hit) return hit
    await delay()
    const rows = filterByOrgs(notificationStore, scoped)
      .filter((row) => row.audience !== 'farmer')
      .map(withOrgName)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    return cacheSet(key, {
      ...paginate(rows, page, limit),
      unreadCount: METRIC_DASH,
    })
  },

  async markNotificationRead(id) {
    requireAuth()
    await delay(120)
    const item = notificationStore.find((row) => row.id === id)
    if (!item) {
      const error = new Error('Không tìm thấy thông báo.')
      error.status = 404
      throw error
    }
    item.read = true
    cacheInvalidate('notifications')
    bumpMockStore()
    return withOrgName({ ...item })
  },

  async markAllNotificationsRead(orgIds) {
    const scoped = scopedOrgIds(orgIds)
    await delay(120)
    filterByOrgs(notificationStore, scoped).forEach((row) => {
      row.read = true
    })
    cacheInvalidate('notifications')
    bumpMockStore()
    return { ok: true }
  },

  async dismissNotification(id) {
    requireAuth()
    await delay(120)
    const index = notificationStore.findIndex((row) => row.id === id)
    if (index < 0) {
      const error = new Error('Không tìm thấy thông báo.')
      error.status = 404
      throw error
    }
    notificationStore.splice(index, 1)
    cacheInvalidate('notifications')
    bumpMockStore()
    return { ok: true }
  },

  async search({ q = '', types, orgIds, page = 1, limit = 10 } = {}) {
    const scoped = scopedOrgIds(orgIds)
    await delay(160)
    const needle = String(q).trim().toLowerCase()
    const allowed = types && types.length ? new Set(types) : null
    const hits = []

    if (!allowed || allowed.has('field')) {
      filterByOrgs(fieldStore, scoped).forEach((row) => {
        const hay = `${row.name} ${row.variety}`.toLowerCase()
        if (!needle || hay.includes(needle)) {
          hits.push({
            id: row.id,
            type: 'field',
            title: row.name,
            subtitle: `${row.variety} · ${row.areaHa} ha`,
            orgId: row.orgId,
            href: searchHref('field', { id: row.id }),
          })
        }
      })
    }
    if (!allowed || allowed.has('alert')) {
      filterByOrgs(alertStore, scoped).forEach((row) => {
        const hay = `${row.title} ${row.fieldName} ${row.summary}`.toLowerCase()
        if (!needle || hay.includes(needle)) {
          hits.push({
            id: row.id,
            type: 'alert',
            title: row.title,
            subtitle: row.fieldName,
            orgId: row.orgId,
            href: searchHref('alert'),
          })
        }
      })
    }
    if (!allowed || allowed.has('farmer')) {
      filterByOrgs(farmerStore, scoped).forEach((row) => {
        const hay = `${row.fullName} ${row.phone}`.toLowerCase()
        if (!needle || hay.includes(needle)) {
          hits.push({
            id: row.id,
            type: 'farmer',
            title: row.fullName,
            subtitle: row.phone,
            orgId: row.orgId,
            href: searchHref('farmer'),
          })
        }
      })
    }
    if (!allowed || allowed.has('station')) {
      filterByOrgs(stationStore, scoped).forEach((row) => {
        const hay = `${row.code} ${row.fieldName}`.toLowerCase()
        if (!needle || hay.includes(needle)) {
          hits.push({
            id: row.id,
            type: 'station',
            title: row.code,
            subtitle: row.fieldName,
            orgId: row.orgId,
            href: searchHref('station', { id: row.id, fieldId: row.fieldId }),
          })
        }
      })
    }

    const session = requireAuth()
    let visible = hits.map(withOrgName)
    if (session.user.role === 'technician') {
      visible = visible.filter((row) => row.type === 'field' || row.type === 'alert' || row.type === 'station')
    } else if (session.user.role === 'manager') {
      visible = visible.filter((row) => row.type === 'field' || row.type === 'alert' || row.type === 'farmer')
    }
    return paginate(visible, page, limit)
  },

  async getSettings() {
    requireAuth()
    return { ...readSettings() }
  },

  async updateSettings(patch) {
    const session = requireAuth()
    const current = readSettings()
    const next = { ...current, ...patch }
    if (session.user.role !== 'admin') {
      delete next.maintenanceMode
      next.maintenanceMode = current.maintenanceMode
      delete next.allowNewOrgs
      next.allowNewOrgs = current.allowNewOrgs
    }
    writeSettings(next)
    return { ...next }
  },

  async getMapFeatures(orgIds) {
    return this.getFieldBoard(orgIds)
  },

  async getFieldBoard(orgIds) {
    if (!UI_ONLY) {
      return liveFieldBoard(orgIds)
    }
    requireAuth()
    const scoped = scopedOrgIds(orgIds)
    await delay(120)
    return fieldBoardFromFields(scoped)
  },

  async getField(id) {
    if (!UI_ONLY) {
      requireAuth()
      const row = await request(`/api/technician/fields/${id}`)
      return withNormalizedCover(row)
    }
    requireAuth()
    await delay()
    const field = fieldStore.find((row) => row.id === id)
    if (!field) {
      const error = new Error('Không tìm thấy thửa.')
      error.status = 404
      throw error
    }
    assertOrgAccess(field.orgId)
    return withFieldBoard(field)
  },

  async uploadFieldCover(id, file, source = 'upload') {
    requireAuth()
    const name = String(file?.name || '').toLowerCase()
    const type = String(file?.type || '')
    const tiff = name.endsWith('.tif') || name.endsWith('.tiff')
    if (!file || (!type.startsWith('image/') && !tiff)) {
      throw new Error('Chọn tệp ảnh (JPG, PNG, WebP, TIFF RGB).')
    }
    if (!UI_ONLY) {
      const form = new FormData()
      form.append('image', file, file.name || 'cover.jpg')
      form.append('source', source === 'uav' ? 'uav' : 'upload')
      const next = await requestForm(`/api/technician/fields/${id}/cover`, form)
      cacheInvalidate('fields')
      return withNormalizedCover(next)
    }
    const field = fieldStore.find((row) => row.id === id)
    if (!field) throw new Error('Không tìm thấy thửa.')
    assertOrgAccess(field.orgId)
    await delay(120)
    const url = typeof URL !== 'undefined' && file ? URL.createObjectURL(file) : null
    field.coverUrl = url
    field.coverImageUrl = url
    field.coverFileName = file.name || 'cover.jpg'
    field.coverSource = source === 'uav' ? 'uav' : 'upload'
    cacheInvalidate('fields')
    bumpMockStore()
    return withNormalizedCover({ ...field })
  },

  async cropFieldCover(id, blob, rect) {
    requireAuth()
    if (!blob) throw new Error('Không có vùng cắt.')
    if (!UI_ONLY) {
      const form = new FormData()
      form.append('image', blob, 'crop-cover.jpg')
      if (rect) form.append('rect', JSON.stringify(rect))
      const next = await requestForm(`/api/technician/fields/${id}/cover/crop`, form)
      cacheInvalidate('fields')
      return withNormalizedCover(next)
    }
    const field = fieldStore.find((row) => row.id === id)
    if (!field) throw new Error('Không tìm thấy thửa.')
    assertOrgAccess(field.orgId)
    await delay(120)
    const url = typeof URL !== 'undefined' ? URL.createObjectURL(blob) : null
    field.coverUrl = url
    field.coverImageUrl = url
    cacheInvalidate('fields')
    bumpMockStore()
    return withNormalizedCover({ ...field })
  },

  async saveFieldCoverOutline(id, points) {
    requireAuth()
    const vertexCount = String(points || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length
    if (vertexCount < 3) throw new Error('Vẽ ít nhất 3 đỉnh rồi đóng ranh giới.')
    if (!UI_ONLY) {
      const next = await request(`/api/technician/fields/${id}/cover/outline`, {
        method: 'PUT',
        body: JSON.stringify({ points: String(points).trim() }),
      })
      cacheInvalidate('fields')
      return withNormalizedCover(next)
    }
    const field = fieldStore.find((row) => row.id === id)
    if (!field) throw new Error('Không tìm thấy thửa.')
    assertOrgAccess(field.orgId)
    await delay(80)
    field.coverOutline = { points: String(points).trim() }
    cacheInvalidate('fields')
    bumpMockStore()
    return withNormalizedCover({ ...field })
  },

  async rerunFieldBlbSegment(id) {
    requireAuth()
    if (!UI_ONLY) {
      const next = await request(`/api/technician/fields/${id}/blb-segment`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      cacheInvalidate('fields')
      return withNormalizedCover(next)
    }
    const field = fieldStore.find((row) => row.id === id)
    if (!field) throw new Error('Không tìm thấy thửa.')
    assertOrgAccess(field.orgId)
    await delay(120)
    field.blbDiseasePct = null
    cacheInvalidate('fields')
    bumpMockStore()
    return withNormalizedCover({ ...field })
  },

  async getSensorReadings({ stationId, orgIds } = {}) {
    const scoped = scopedOrgIds(orgIds)
    await delay(120)
    let rows = sensorReadingStore.filter((row) => !stationId || row.stationId === stationId)
    if (scoped) rows = rows.filter((row) => scoped.includes(row.orgId))
    const stations = filterByOrgs(stationStore, scoped)
    return {
      stations: stations.map(withStationExtras),
      thresholds: aiConfig.applied,
      items: [...rows].sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt))),
    }
  },

  async getFarmerPhotos({ orgIds, reviewed, page = 1, limit = 20 } = {}) {
    requireAuth()
    const scoped = scopedOrgIds(orgIds)
    await delay()
    let rows = filterByOrgs(photoStore, scoped).map((row) => withPhotoSolution(withOrgName(row)))
    if (reviewed === true) rows = rows.filter((row) => row.reviewed)
    if (reviewed === false) rows = rows.filter((row) => !row.reviewed)
    rows = [...rows].sort((a, b) => String(b.createdAt || b.capturedAt || '').localeCompare(String(a.createdAt || a.capturedAt || '')))
    return paginate(rows, page, limit)
  },

  async rescanFarmerPhoto(id) {
    requireAuth()
    await delay(120)
    const photo = photoStore.find((row) => row.id === id)
    if (!photo) throw new Error('Không tìm thấy ảnh.')
    assertOrgAccess(photo.orgId)
    cacheInvalidate('photos')
    bumpMockStore()
    return withPhotoSolution(withOrgName({ ...photo }))
  },

  async markPhotoReviewed(id) {
    requireAuth()
    await delay(80)
    const photo = photoStore.find((row) => row.id === id)
    if (!photo) throw new Error('Không tìm thấy ảnh.')
    assertOrgAccess(photo.orgId)
    photo.reviewed = true
    cacheInvalidate('photos')
    bumpMockStore()
    return withPhotoSolution(withOrgName({ ...photo }))
  },

  async getUavSurveys(orgIds) {
    const scoped = scopedOrgIds(orgIds)
    await delay()
    return filterByOrgs(uavStore, scoped)
      .map(withOrgName)
      .sort((a, b) => String(b.flownAt).localeCompare(String(a.flownAt)))
  },

  async createUavSurvey({ orgId, name, coverageHa, note, flownAt }) {
    requireAuth()
    await delay()
    const item = {
      id: `uav_${Date.now()}`,
      orgId,
      name,
      flownAt: flownAt || new Date().toISOString(),
      coverageHa: Number(coverageHa) || 0,
      status: 'queued',
      note: note || 'Chờ hàng đợi xử lý.',
    }
    uavStore.unshift(item)
    bumpMockStore()
    return withOrgName({ ...item })
  },

  async deleteUavSurvey(id) {
    requireAuth()
    await delay(120)
    const index = uavStore.findIndex((row) => row.id === id)
    if (index < 0) throw new Error('Không tìm thấy đợt UAV.')
    uavStore.splice(index, 1)
    uavAssetStore = uavAssetStore.filter((row) => row.surveyId !== id)
    bumpMockStore()
    return { ok: true }
  },

  async getUavAssets(surveyId) {
    requireAuth()
    await delay(80)
    return uavAssetStore.filter((row) => row.surveyId === surveyId)
  },

  async deleteUavAsset(id) {
    requireAuth()
    await delay(120)
    const index = uavAssetStore.findIndex((row) => row.id === id)
    if (index < 0) throw new Error('Không tìm thấy tệp UAV.')
    uavAssetStore.splice(index, 1)
    bumpMockStore()
    return { ok: true }
  },

  async advanceUavSurvey(id) {
    requireAuth()
    await delay(400)
    const item = uavStore.find((row) => row.id === id)
    if (!item) throw new Error('Không tìm thấy đợt UAV.')
    if (item.status === 'queued') item.status = 'processing'
    else if (item.status === 'processing') item.status = 'done'
    bumpMockStore()
    return withOrgName({ ...item })
  },

  async getFieldLogs({ orgIds, fieldId, page = 1, limit = 40 } = {}) {
    const scoped = scopedOrgIds(orgIds)
    await delay()
    let rows = filterByOrgs(logStore, scoped).map(withOrgName)
    if (fieldId) rows = rows.filter((row) => row.fieldId === fieldId)
    rows.sort((a, b) => String(b.loggedAt).localeCompare(String(a.loggedAt)))
    return paginate(rows, page, limit)
  },

  async createFieldLog({ orgId, fieldId, type, title, note, loggedAt }) {
    requireAuth()
    await delay()
    const field = fieldStore.find((row) => row.id === fieldId)
    const item = {
      id: `log_${Date.now()}`,
      orgId: orgId || field?.orgId,
      fieldId,
      fieldName: field?.name || '',
      type,
      title,
      note,
      loggedAt: loggedAt || new Date().toISOString(),
    }
    logStore.unshift(item)
    cacheInvalidate('logs')
    bumpMockStore()
    return withOrgName({ ...item })
  },

  async updateFieldLog(id, { fieldId, type, title, note }) {
    requireAuth()
    await delay()
    const item = logStore.find((row) => row.id === id)
    if (!item) throw new Error('Không tìm thấy nhật ký.')
    assertOrgAccess(item.orgId)
    if (fieldId) {
      const field = fieldStore.find((row) => row.id === fieldId)
      if (!field) throw new Error('Không tìm thấy thửa.')
      assertOrgAccess(field.orgId)
      item.fieldId = field.id
      item.fieldName = field.name
      item.orgId = field.orgId
    }
    if (type != null) item.type = type
    if (title != null) item.title = title
    if (note != null) item.note = note
    cacheInvalidate('logs')
    bumpMockStore()
    return withOrgName({ ...item })
  },

  async deleteFieldLog(id) {
    requireAuth()
    await delay(120)
    const index = logStore.findIndex((row) => row.id === id)
    if (index < 0) throw new Error('Không tìm thấy nhật ký.')
    logStore.splice(index, 1)
    cacheInvalidate('logs')
    bumpMockStore()
    return { ok: true }
  },

  async getStations(orgIds) {
    const scoped = scopedOrgIds(orgIds)
    await delay()
    return filterByOrgs(stationStore, scoped).map(withStationExtras)
  },

  async getStation(id, orgIds) {
    const scoped = scopedOrgIds(orgIds)
    await delay()
    const station = stationStore.find((row) => row.id === id)
    if (!station) {
      const error = new Error('Không tìm thấy trạm.')
      error.status = 404
      throw error
    }
    if (scoped && !scoped.includes(station.orgId)) {
      const error = new Error('Không có quyền xem trạm này.')
      error.status = 403
      throw error
    }
    return withStationExtras(station)
  },

  async createStation({ code, name, fieldId, lat, lng }) {
    requireAuth()
    await delay()
    const field = fieldStore.find((row) => row.id === fieldId)
    if (!field) throw new Error('Chọn thửa để gắn trạm.')
    assertOrgAccess(field.orgId)
    if (stationOnField(field.id)) throw new Error('Thửa này đã có trạm IoT.')
    const item = {
      id: `st_${Date.now()}`,
      code: String(code || '').trim().toUpperCase(),
      name: String(name || '').trim(),
      orgId: field.orgId,
      fieldId: field.id,
      fieldName: field.name,
      online: true,
      batteryPct: 100,
      lastSeenAt: new Date().toISOString(),
      issue: null,
      lat: parseLatLng(lat),
      lng: parseLatLng(lng),
    }
    if (!item.code) throw new Error('Nhập mã trạm.')
    stationStore.unshift(item)
    appendAudit('create_station', item.code, `Tạo trạm ${item.code} tại ${field.name}.`)
    cacheInvalidate('fields')
    bumpMockStore()
    return withStationExtras(item)
  },

  async updateStation(id, { code, name, fieldId, issue, lat, lng } = {}) {
    requireAuth()
    await delay()
    const station = findAccessibleStation(id)
    if (fieldId) {
      const field = fieldStore.find((row) => row.id === fieldId)
      if (!field) throw new Error('Không tìm thấy thửa.')
      assertOrgAccess(field.orgId)
      if (stationOnField(field.id, station.id)) throw new Error('Thửa này đã có trạm IoT.')
      station.fieldId = field.id
      station.fieldName = field.name
      station.orgId = field.orgId
    } else if (fieldId === null) {
      const session = getSession()
      if (session.user.role !== 'admin') throw new Error('Chỉ Admin được thu hồi gán thửa.')
      station.fieldId = null
      station.fieldName = 'Chưa gán'
    }
    if (code != null) station.code = String(code).trim().toUpperCase()
    if (name != null) station.name = String(name).trim()
    if (issue !== undefined) station.issue = issue
    if (lat !== undefined) station.lat = parseLatLng(lat)
    if (lng !== undefined) station.lng = parseLatLng(lng)
    appendAudit('update_station', station.code, `Cập nhật trạm ${station.code}.`)
    cacheInvalidate('fields')
    bumpMockStore()
    return withStationExtras(station)
  },

  async deleteStation(id) {
    requireAuth()
    await delay()
    const station = findAccessibleStation(id)
    stationStore = stationStore.filter((row) => row.id !== id)
    sensorReadingStore = sensorReadingStore.filter((row) => row.stationId !== id)
    stationAlertStore = stationAlertStore.filter((row) => row.stationId !== id)
    appendAudit('delete_station', station.code, `Xóa trạm ${station.code}.`)
    cacheInvalidate('fields')
    bumpMockStore()
    return { ok: true }
  },

  async getStationReport(id, orgIds) {
    await delay()
    const station = await this.getStation(id, orgIds)
    const rows = sensorReadingStore.filter((row) => row.stationId === id)
    const thresholds = aiConfig.applied
    const stats = {}
    SENSOR_METRICS.forEach((metric) => {
      const values = rows.map((row) => row[metric.key]).filter((value) => value != null && !Number.isNaN(value))
      if (!values.length) {
        stats[metric.key] = { min: null, max: null, avg: null }
        return
      }
      const sum = values.reduce((total, value) => total + value, 0)
      stats[metric.key] = {
        min: Number(Math.min(...values).toFixed(1)),
        max: Number(Math.max(...values).toFixed(1)),
        avg: Number((sum / values.length).toFixed(1)),
      }
    })
    return {
      station,
      sampleCount: rows.length,
      breachCount: rows.filter((row) => readingBreaches(row, thresholds)).length,
      onlinePct: station.online ? 96 : 38,
      stats,
      thresholds,
    }
  },

  async getStationAlerts(id, orgIds) {
    await delay()
    await this.getStation(id, orgIds)
    return stationAlertStore
      .filter((row) => row.stationId === id)
      .map(withOrgName)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  },

  async createStationAlert(id, { title, body, kind = 'fault' }) {
    requireAuth()
    await delay()
    const station = findAccessibleStation(id)
    const headline = String(title || '').trim()
    const detail = String(body || '').trim()
    if (!headline) throw new Error('Nhập tiêu đề cảnh báo.')
    const item = {
      id: `sta_${Date.now()}`,
      stationId: station.id,
      orgId: station.orgId,
      fieldId: station.fieldId,
      fieldName: station.fieldName,
      kind: kind === 'threshold' ? 'threshold' : 'fault',
      title: headline,
      body: detail || headline,
      createdAt: new Date().toISOString(),
    }
    stationAlertStore.unshift(item)
    if (item.kind === 'fault') station.issue = headline
    pushStationNotifications(station, {
      kind: 'station_fault',
      title: `Trạm ${station.code}: ${headline}`,
      body: item.body,
    })
    appendAudit('station_alert', station.code, headline)
    bumpMockStore()
    return withOrgName({ ...item })
  },

  async requestStationMaintenance(id, note) {
    requireAuth()
    await delay()
    const station = findAccessibleStation(id)
    station.issue = note || 'Yêu cầu bảo trì'
    pushStationNotifications(station, {
      title: `Yêu cầu bảo trì ${station.code}`,
      body: station.issue,
    })
    bumpMockStore()
    return withStationExtras(station)
  },

  async getInspections(orgIds) {
    const scoped = scopedOrgIds(orgIds)
    await delay()
    return filterByOrgs(inspectionStore, scoped)
      .map(withOrgName)
      .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)))
  },

  async createInspection({ orgId, fieldId, scheduledAt, alertId, note }) {
    requireAuth()
    await delay()
    const field = fieldStore.find((row) => row.id === fieldId)
    const item = {
      id: `ins_${Date.now()}`,
      orgId: orgId || field?.orgId,
      fieldId,
      fieldName: field?.name || '',
      scheduledAt,
      status: 'open',
      alertId: alertId || null,
      note,
    }
    inspectionStore.unshift(item)
    bumpMockStore()
    return withOrgName({ ...item })
  },

  async updateInspection(id, { fieldId, scheduledAt, alertId, note }) {
    requireAuth()
    await delay()
    const item = inspectionStore.find((row) => row.id === id)
    if (!item) throw new Error('Không tìm thấy lịch kiểm tra.')
    assertOrgAccess(item.orgId)
    if (item.status === 'done') throw new Error('Không sửa lịch đã hoàn thành.')
    if (fieldId) {
      const field = fieldStore.find((row) => row.id === fieldId)
      if (!field) throw new Error('Không tìm thấy thửa.')
      assertOrgAccess(field.orgId)
      item.fieldId = field.id
      item.fieldName = field.name
      item.orgId = field.orgId
    }
    if (scheduledAt != null) item.scheduledAt = scheduledAt
    if (alertId !== undefined) item.alertId = alertId || null
    if (note != null) item.note = note
    bumpMockStore()
    return withOrgName({ ...item })
  },

  async deleteInspection(id) {
    requireAuth()
    await delay(120)
    const item = inspectionStore.find((row) => row.id === id)
    if (!item) throw new Error('Không tìm thấy lịch kiểm tra.')
    assertOrgAccess(item.orgId)
    inspectionStore = inspectionStore.filter((row) => row.id !== id)
    bumpMockStore()
    return { ok: true }
  },

  async completeInspection(id) {
    requireAuth()
    await delay(120)
    const item = inspectionStore.find((row) => row.id === id)
    if (!item) throw new Error('Không tìm thấy lịch kiểm tra.')
    item.status = 'done'
    bumpMockStore()
    return withOrgName({ ...item })
  },

  async getSeasonReports({ orgIds, seasonId } = {}) {
    const scoped = scopedOrgIds(orgIds)
    await delay()
    const season = SEASONS.find((row) => row.id === seasonId) || SEASONS[0]
    const fields = filterByOrgs(fieldStore, scoped)
    const alerts = filterByOrgs(alertStore, scoped)
    const logs = filterByOrgs(logStore, scoped)
    const byOrg = {}
    fields.forEach((field) => {
      const bucket = (byOrg[field.orgId] ||= {
        orgId: field.orgId,
        areaHa: 0,
        fields: 0,
        alerts: 0,
        logs: 0,
      })
      bucket.areaHa += field.areaHa
      bucket.fields += 1
    })
    alerts.forEach((row) => {
      if (byOrg[row.orgId]) byOrg[row.orgId].alerts += 1
    })
    logs.forEach((row) => {
      if (byOrg[row.orgId]) byOrg[row.orgId].logs += 1
    })
    return {
      season,
      seasons: SEASONS,
      items: Object.values(byOrg).map(withOrgName),
    }
  },

  async exportTraceability({ fieldId, seasonId, format = 'csv' } = {}) {
    requireAuth()
    await delay()
    const field = fieldStore.find((row) => row.id === fieldId)
    const season = SEASONS.find((row) => row.id === seasonId) || SEASONS[0]
    if (!field) throw new Error('Chọn thửa để xuất báo cáo.')
    const logs = logStore.filter((row) => row.fieldId === fieldId)
    const header = 'thửa,mùa vụ,ngày,loại,nội dung'
    const lines = logs.map(
      (row) => `${field.name},${season.name},${row.loggedAt},${row.type},${row.title} ${row.note || ''}`,
    )
    const body = [header, ...lines].join('\n')
    return {
      filename: `truy-xuat-${field.id}-${season.id}.${format === 'txt' ? 'txt' : 'csv'}`,
      body,
    }
  },

  async getFarmers(orgIds) {
    const scoped = scopedOrgIds(orgIds)
    await delay()
    return filterByOrgs(farmerStore, scoped).map(withOrgName)
  },

  async createFarmer({ fullName, phone, fieldId }) {
    requireAuth()
    await delay()
    const field = fieldStore.find((row) => row.id === fieldId)
    const item = {
      id: `frm_${Date.now()}`,
      orgId: field?.orgId || scopedOrgIds()?.[0],
      fullName,
      phone,
      fieldIds: fieldId ? [fieldId] : [],
      fieldNames: field ? [field.name] : [],
      appAccount: false,
    }
    farmerStore.unshift(item)
    bumpMockStore()
    return withOrgName({ ...item })
  },

  async updateFarmerContact(id, phone) {
    requireAuth()
    await delay(120)
    const farmer = farmerStore.find((row) => row.id === id)
    if (!farmer) throw new Error('Không tìm thấy hộ.')
    farmer.phone = phone
    bumpMockStore()
    return withOrgName({ ...farmer })
  },

  async grantFarmerApp(id) {
    requireAuth()
    await delay(120)
    const farmer = farmerStore.find((row) => row.id === id)
    if (!farmer) throw new Error('Không tìm thấy hộ.')
    farmer.appAccount = true
    bumpMockStore()
    return withOrgName({ ...farmer })
  },

  async deleteFarmer(id) {
    requireAuth()
    await delay(120)
    const farmer = farmerStore.find((row) => row.id === id)
    if (!farmer) throw new Error('Không tìm thấy hộ.')
    assertOrgAccess(farmer.orgId)
    farmerStore = farmerStore.filter((row) => row.id !== id)
    bumpMockStore()
    return { ok: true }
  },

  async updateField(id, patch) {
    requireAuth()
    await delay(120)
    const field = fieldStore.find((row) => row.id === id)
    if (!field) throw new Error('Không tìm thấy thửa.')
    assertOrgAccess(field.orgId)
    if (patch.points != null) {
      const vertexCount = String(patch.points).trim().split(/\s+/).filter(Boolean).length
      if (vertexCount < 3) throw new Error('Vẽ ít nhất 3 đỉnh ranh giới.')
    }
    const next = { ...patch }
    delete next.farmerIds
    Object.assign(field, next)
    if (Array.isArray(patch.farmerIds)) applyFieldFarmers(field.id, patch.farmerIds)
    cacheInvalidate('fields')
    bumpMockStore()
    return withOrgName({ ...field })
  },

  async createField({ orgId, name, areaHa, variety, points, farmerIds }) {
    requireAuth()
    await delay()
    const scoped = scopedOrgIds()
    let resolvedOrg = orgId
    if (!resolvedOrg) {
      if (scoped?.length === 1) resolvedOrg = scoped[0]
      else throw new Error('Chọn đơn vị cho thửa.')
    }
    assertOrgAccess(resolvedOrg)
    const pts = String(points || '').trim()
    const vertexCount = pts.split(/\s+/).filter(Boolean).length
    if (vertexCount < 3) throw new Error('Vẽ ít nhất 3 đỉnh ranh giới.')
    const headline = String(name || '').trim()
    if (!headline) throw new Error('Nhập tên thửa.')
    const item = {
      id: `fld_${Date.now()}`,
      name: headline,
      orgId: resolvedOrg,
      areaHa: Number(areaHa) || 0,
      variety: String(variety || '').trim(),
      riskLevel: 'low',
      riskType: 'environment',
      points: pts,
      coverImageUrl: null,
      coverFileName: null,
      coverOutline: null,
    }
    fieldStore.unshift(item)
    bumpOrgFieldCount(resolvedOrg, 1)
    applyFieldFarmers(item.id, farmerIds)
    appendAudit('create_field', item.name, `Tạo thửa ${item.name}.`)
    cacheInvalidate('fields')
    bumpMockStore()
    return withOrgName({ ...item })
  },

  async deleteField(id) {
    requireAuth()
    await delay()
    const field = fieldStore.find((row) => row.id === id)
    if (!field) throw new Error('Không tìm thấy thửa.')
    assertOrgAccess(field.orgId)
    const linked = stationStore.some((row) => row.fieldId === id)
    if (linked) throw new Error('Không xóa thửa còn trạm IoT. Thu hồi hoặc chuyển trạm trước.')
    fieldStore = fieldStore.filter((row) => row.id !== id)
    farmerStore.forEach((farmer) => {
      if (!(farmer.fieldIds || []).includes(id)) return
      farmer.fieldIds = farmer.fieldIds.filter((fieldId) => fieldId !== id)
      syncFarmerFieldNames(farmer)
    })
    bumpOrgFieldCount(field.orgId, -1)
    appendAudit('delete_field', field.name, `Xóa thửa ${field.name}.`)
    cacheInvalidate('fields')
    bumpMockStore()
    return { ok: true }
  },

  async setFieldFarmers(fieldId, farmerIds) {
    requireAuth()
    await delay()
    const field = fieldStore.find((row) => row.id === fieldId)
    if (!field) throw new Error('Không tìm thấy thửa.')
    assertOrgAccess(field.orgId)
    applyFieldFarmers(fieldId, farmerIds)
    bumpMockStore()
    return withOrgName({ ...field })
  },

  async setFieldBoundary(id, lat, lng) {
    requireAuth()
    await delay()
    const field = fieldStore.find((row) => row.id === id)
    if (!field) throw new Error('Không tìm thấy thửa.')
    field.boundary = { lat: Number(lat), lng: Number(lng) }
    bumpMockStore()
    return withOrgName({ ...field })
  },

  async getOrgTechnicians(orgIds) {
    const scoped = scopedOrgIds(orgIds)
    await delay()
    return technicianStore
      .filter((row) => !scoped || row.orgIds.some((id) => scoped.includes(id)))
      .map((row) => ({
        ...row,
        orgNames: row.orgIds.map((id) => ORG_NAME[id]).filter(Boolean),
      }))
  },

  async assignTechnicianRegion(id, region) {
    requireAuth()
    await delay()
    const person = technicianStore.find((row) => row.id === id)
    if (!person) throw new Error('Không tìm thấy kỹ thuật viên.')
    person.region = region
    bumpMockStore()
    return { ...person }
  },

  async getUsers({ page = 1, limit = 100, q = '', role = '', status = '', excludeRole = '' } = {}) {
    requireAdmin()
    await delay()
    let rows = userStore.map((row) => publicUser(row))
    const query = String(q || '').trim().toLowerCase()
    if (query) {
      rows = rows.filter(
        (row) =>
          row.fullName.toLowerCase().includes(query) ||
          row.email.toLowerCase().includes(query) ||
          String(row.phone || '').includes(query),
      )
    }
    if (role) rows = rows.filter((row) => row.role === role)
    if (excludeRole) rows = rows.filter((row) => row.role !== excludeRole)
    if (status === 'locked') rows = rows.filter((row) => row.locked)
    if (status === 'active') rows = rows.filter((row) => !row.locked)
    return paginate(rows, page, limit)
  },

  async createUser({ fullName, email, phone, role, password }) {
    requireAdmin()
    await delay()
    const item = {
      id: `usr_${Date.now()}`,
      fullName,
      email,
      phone,
      role: role || 'farmer',
      password: password || DEMO_PASSWORD,
      organizationIds: [],
      locked: false,
    }
    userStore.unshift(item)
    appendAudit('create_user', fullName, `Tạo tài khoản ${role}.`)
    bumpMockStore()
    return publicUser(item)
  },

  async lockUser(id) {
    requireAdmin()
    await delay()
    const user = userStore.find((row) => row.id === id)
    if (!user) throw new Error('Không tìm thấy người dùng.')
    user.locked = !user.locked
    appendAudit(user.locked ? 'lock_user' : 'unlock_user', user.fullName, '')
    bumpMockStore()
    return publicUser(user)
  },

  async resetUserPassword(id) {
    requireAdmin()
    await delay()
    const user = userStore.find((row) => row.id === id)
    if (!user) throw new Error('Không tìm thấy người dùng.')
    user.password = DEMO_PASSWORD
    appendAudit('reset_password', user.fullName, '')
    bumpMockStore()
    return { ok: true, temporaryPassword: DEMO_PASSWORD }
  },

  async deleteUser(id) {
    requireAdmin()
    await delay()
    const index = userStore.findIndex((row) => row.id === id)
    if (index < 0) throw new Error('Không tìm thấy người dùng.')
    const [removed] = userStore.splice(index, 1)
    appendAudit('delete_user', removed.fullName, '')
    bumpMockStore()
    return { ok: true }
  },

  async getOrganizationsAdmin() {
    requireAdmin()
    await delay()
    return orgStore.map((row) => ({ ...row }))
  },

  async createOrganization({ name }) {
    requireAdmin()
    await delay()
    const item = {
      id: `org_${Date.now()}`,
      name,
      fieldCount: 0,
      unreadAlerts: 0,
      unreadNotifications: 0,
      status: 'active',
    }
    orgStore.unshift(item)
    appendAudit('create_org', name, 'Tạo đơn vị thủ công.')
    bumpMockStore()
    return { ...item }
  },

  async updateOrganization(id, patch) {
    requireAdmin()
    await delay()
    const org = orgStore.find((row) => row.id === id)
    if (!org) throw new Error('Không tìm thấy đơn vị.')
    Object.assign(org, patch)
    appendAudit('update_org', org.name, 'Cập nhật đơn vị.')
    bumpMockStore()
    return { ...org }
  },

  async toggleOrganization(id) {
    requireAdmin()
    await delay()
    const org = orgStore.find((row) => row.id === id)
    if (!org) throw new Error('Không tìm thấy đơn vị.')
    if (org.status === 'pending') throw new Error('Duyệt đăng ký trước khi khóa/mở.')
    org.status = org.status === 'locked' ? 'active' : 'locked'
    appendAudit(org.status === 'locked' ? 'lock_org' : 'unlock_org', org.name, `Trạng thái ${org.status}.`)
    bumpMockStore()
    return { ...org }
  },

  async approveOrganization(id) {
    requireAdmin()
    await delay()
    const org = orgStore.find((row) => row.id === id)
    if (!org) throw new Error('Không tìm thấy đơn vị.')
    if (org.status !== 'pending') throw new Error('Đơn vị này không chờ duyệt.')
    org.status = 'active'
    appendAudit('approve_org', org.name, 'Duyệt đăng ký đơn vị.')
    bumpMockStore()
    return { ...org }
  },

  async getDevices() {
    requireAdmin()
    await delay()
    return stationStore.map((row) => withStationExtras(row))
  },

  async assignDevice(id, fieldId) {
    requireAdmin()
    await delay()
    const device = stationStore.find((row) => row.id === id)
    const field = fieldStore.find((row) => row.id === fieldId)
    if (!device || !field) throw new Error('Không gán được thiết bị.')
    device.fieldId = field.id
    device.fieldName = field.name
    device.orgId = field.orgId
    appendAudit('assign_device', device.code, `Gán ${device.code} → ${field.name}.`)
    bumpMockStore()
    return withOrgName({ ...device })
  },

  async revokeDevice(id) {
    requireAdmin()
    await delay()
    const device = stationStore.find((row) => row.id === id)
    if (!device) throw new Error('Không tìm thấy thiết bị.')
    appendAudit('revoke_device', device.code, `Thu hồi ${device.code}.`)
    device.fieldId = null
    device.fieldName = 'Chưa gán'
    bumpMockStore()
    return withOrgName({ ...device })
  },

  async getAiConfig() {
    requireAdmin()
    await delay(80)
    return JSON.parse(JSON.stringify(aiConfig))
  },

  async updateAiStaging(patch) {
    requireAdmin()
    await delay()
    aiConfig.staging = { ...aiConfig.staging, ...patch }
    return JSON.parse(JSON.stringify(aiConfig))
  },

  async applyAiConfig() {
    requireAdmin()
    await delay()
    aiConfig.applied = { ...aiConfig.staging }
    aiConfig.appliedAt = new Date().toISOString()
    appendAudit('apply_ai_config', 'thresholds', 'Áp dụng ngưỡng staging.')
    return JSON.parse(JSON.stringify(aiConfig))
  },

  async getSystemHealth() {
    requireAuth()
    return buildSystemHealth({ stations: stationStore })
  },

  async getTrainingQueue() {
    requireAdmin()
    await delay()
    return trainingQueue
      .filter((row) => row.status === 'confirmed' || row.status === 'incorrect')
      .map((row) => withOrgName({ ...row }))
  },

  async approveTrainingItem(id) {
    requireAdmin()
    await delay()
    const item = trainingQueue.find((row) => row.id === id)
    if (!item) throw new Error('Không tìm thấy mẫu.')
    item.approved = true
    appendAudit('approve_training', item.alertId, 'Duyệt vào tập train.')
    bumpMockStore()
    return { ...item }
  },

  async getAuditLogs({ action, page = 1, limit = 40 } = {}) {
    requireAdmin()
    await delay()
    let rows = [...auditStore]
    if (action) rows = rows.filter((row) => row.action === action)
    return paginate(rows, page, limit)
  },

  async getAssignments() {
    requireAdmin()
    await delay()
    return technicianStore.map((row) => ({
      ...row,
      orgNames: row.orgIds.map((id) => ORG_NAME[id] || id),
    }))
  },

  async assignKtv(userId, orgId) {
    requireAdmin()
    await delay()
    const person = technicianStore.find((row) => row.id === userId)
    if (!person) throw new Error('Không tìm thấy KTV.')
    if (!person.orgIds.includes(orgId)) person.orgIds = [...person.orgIds, orgId]
    appendAudit('assign_ktv', person.fullName, `Gán vào ${ORG_NAME[orgId] || orgId}.`)
    bumpMockStore()
    return { ...person, orgNames: person.orgIds.map((id) => ORG_NAME[id] || id) }
  },

  async unassignKtv(userId, orgId) {
    requireAdmin()
    await delay()
    const person = technicianStore.find((row) => row.id === userId)
    if (!person) throw new Error('Không tìm thấy KTV.')
    person.orgIds = person.orgIds.filter((id) => id !== orgId)
    appendAudit('unassign_ktv', person.fullName, `Gỡ khỏi ${ORG_NAME[orgId] || orgId}.`)
    bumpMockStore()
    return { ...person, orgNames: person.orgIds.map((id) => ORG_NAME[id] || id) }
  },

  _articlesBase() {
    const role = getSession()?.user?.role
    return role === 'admin' ? '/api/admin' : '/api/technician'
  },

  async getArticles({ page = 1, limit = 20, status = '', category = '', q = '', pendingOnly = false } = {}) {
    requireAuth()
    await delay(80)
    let rows = [...articleStore]
    if (status) rows = rows.filter((row) => row.status === status)
    if (category) rows = rows.filter((row) => row.category === category)
    if (pendingOnly) rows = rows.filter((row) => row.status === 'pending_review')
    const query = String(q || '').trim().toLowerCase()
    if (query) rows = rows.filter((row) => String(row.title || '').toLowerCase().includes(query))
    return paginate(rows, page, limit)
  },

  async getArticle(id) {
    requireAuth()
    await delay(80)
    const item = articleStore.find((row) => row.id === id)
    if (!item) {
      const error = new Error('Không tìm thấy bài viết.')
      error.status = 404
      throw error
    }
    return { ...item }
  },

  async createArticle(payload) {
    requireAuth()
    await delay(80)
    const item = {
      id: `art_${Date.now()}`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      ...payload,
    }
    articleStore.unshift(item)
    bumpMockStore()
    return { ...item }
  },

  async updateArticle(id, payload) {
    requireAuth()
    await delay(80)
    const item = articleStore.find((row) => row.id === id)
    if (!item) throw new Error('Không tìm thấy bài viết.')
    Object.assign(item, payload)
    bumpMockStore()
    return { ...item }
  },

  async publishArticle(id) {
    requireAdmin()
    await delay(80)
    const item = articleStore.find((row) => row.id === id)
    if (!item) throw new Error('Không tìm thấy bài viết.')
    item.status = 'published'
    bumpMockStore()
    return { ...item }
  },

  async archiveArticle(id) {
    requireAdmin()
    await delay(80)
    const item = articleStore.find((row) => row.id === id)
    if (!item) throw new Error('Không tìm thấy bài viết.')
    item.status = 'archived'
    bumpMockStore()
    return { ...item }
  },

  async approveArticle(id) {
    requireAdmin()
    await delay(80)
    const item = articleStore.find((row) => row.id === id)
    if (!item) throw new Error('Không tìm thấy bài viết.')
    item.status = 'published'
    bumpMockStore()
    return { ...item }
  },

  async rejectArticle(id, note = '') {
    requireAdmin()
    await delay(80)
    const item = articleStore.find((row) => row.id === id)
    if (!item) throw new Error('Không tìm thấy bài viết.')
    item.status = 'draft'
    item.rejectNote = note
    bumpMockStore()
    return { ...item }
  },

  async submitArticleReview(id) {
    requireAuth()
    await delay(80)
    const item = articleStore.find((row) => row.id === id)
    if (!item) throw new Error('Không tìm thấy bài viết.')
    item.status = 'pending_review'
    bumpMockStore()
    return { ...item }
  },

  async uploadArticleCover(file) {
    requireAuth()
    await delay(80)
    const url = file && typeof URL !== 'undefined' ? URL.createObjectURL(file) : null
    return { url, coverUrl: url }
  },

  async getArticleQuestions({ page = 1, limit = 20, status = '', articleId = '', q = '' } = {}) {
    requireAuth()
    await delay(80)
    let rows = [...articleQuestionStore]
    if (status) rows = rows.filter((row) => row.status === status)
    if (articleId) rows = rows.filter((row) => row.articleId === articleId)
    const query = String(q || '').trim().toLowerCase()
    if (query) rows = rows.filter((row) => String(row.body || row.question || '').toLowerCase().includes(query))
    return paginate(rows, page, limit)
  },

  async getArticleQuestion(id) {
    requireAuth()
    await delay(80)
    const item = articleQuestionStore.find((row) => row.id === id)
    if (!item) {
      const error = new Error('Không tìm thấy câu hỏi.')
      error.status = 404
      throw error
    }
    return { ...item }
  },

  async replyArticleQuestion(id, { answerBody, isPublic = false, notify = true }) {
    requireAuth()
    await delay(80)
    const item = articleQuestionStore.find((row) => row.id === id)
    if (!item) throw new Error('Không tìm thấy câu hỏi.')
    item.answerBody = answerBody
    item.isPublic = isPublic
    item.notify = notify
    item.status = 'answered'
    bumpMockStore()
    return { ...item }
  },

  async hideArticleQuestion(id) {
    requireAuth()
    await delay(80)
    const item = articleQuestionStore.find((row) => row.id === id)
    if (!item) throw new Error('Không tìm thấy câu hỏi.')
    item.status = 'hidden'
    bumpMockStore()
    return { ...item }
  },
}
