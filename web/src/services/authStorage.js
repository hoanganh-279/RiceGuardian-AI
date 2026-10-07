const TOKEN_KEY = 'rg_access_token'
const SESSION_KEY = 'rg_session'
const FILTER_KEY = 'rg_selected_org_ids'
const LOCK_PREFIX = 'rg_lockout:'
const PASSWORD_PREFIX = 'rg_password:'
const PROFILE_PREFIX = 'rg_profile:'

const MAX_ATTEMPTS = 5
const LOCK_MS = 15 * 60 * 1000

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function normalizeIdentifier(value) {
  const trimmed = String(value || '').trim()
  if (/^[0-9+\s]+$/.test(trimmed)) {
    return trimmed.replace(/\s+/g, '')
  }
  return trimmed.toLowerCase()
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getSession() {
  return readJson(SESSION_KEY, null)
}

export function setSession(token, session) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(FILTER_KEY)
}

export function getSelectedOrgIds(fallbackIds) {
  try {
    const raw = sessionStorage.getItem(FILTER_KEY)
    const stored = raw ? JSON.parse(raw) : null
    if (Array.isArray(stored) && stored.length) return stored
  } catch {
    /* ignore */
  }
  return fallbackIds
}

export function setSelectedOrgIds(ids) {
  sessionStorage.setItem(FILTER_KEY, JSON.stringify(ids))
}

export function getPasswordOverride(userId) {
  return localStorage.getItem(PASSWORD_PREFIX + userId)
}

export function setPasswordOverride(userId, password) {
  localStorage.setItem(PASSWORD_PREFIX + userId, password)
}

export function getProfileOverride(userId) {
  return readJson(PROFILE_PREFIX + userId, null)
}

export function setProfileOverride(userId, patch) {
  const next = { ...getProfileOverride(userId), ...patch }
  localStorage.setItem(PROFILE_PREFIX + userId, JSON.stringify(next))
  return next
}

export function getLockout(identifier) {
  const key = LOCK_PREFIX + normalizeIdentifier(identifier)
  const data = readJson(key, { attempts: 0, lockedUntil: 0 })
  if (data.lockedUntil && data.lockedUntil <= Date.now()) {
    localStorage.removeItem(key)
    return { attempts: 0, lockedUntil: 0, locked: false }
  }
  return { ...data, locked: Boolean(data.lockedUntil && data.lockedUntil > Date.now()) }
}

export function recordFailedLogin(identifier) {
  const key = LOCK_PREFIX + normalizeIdentifier(identifier)
  const current = getLockout(identifier)
  const attempts = current.attempts + 1
  const lockedUntil = attempts >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0
  const next = { attempts: lockedUntil ? MAX_ATTEMPTS : attempts, lockedUntil }
  localStorage.setItem(key, JSON.stringify(next))
  return {
    ...next,
    locked: Boolean(lockedUntil),
    remaining: Math.max(0, MAX_ATTEMPTS - attempts),
  }
}

export function clearLockout(identifier) {
  localStorage.removeItem(LOCK_PREFIX + normalizeIdentifier(identifier))
}

export function remainingLockMinutes(lockedUntil) {
  return Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000))
}
