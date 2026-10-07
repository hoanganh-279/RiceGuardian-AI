import { DISEASE_CATALOG } from './diseaseCatalog.js'
import { api } from '../services/api.js'
import { actionKey, mergeActions, normalizeAction } from './diseasePlanOverlay.js'

const listeners = new Set()
let cachedPlans = null

function notify() {
  listeners.forEach((fn) => fn())
}

export function subscribeDiseasePlans(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function fallbackPlans() {
  return DISEASE_CATALOG.map((row) => ({ ...row, actions: [...row.actions] }))
}

/** Full catalog with base actions + imported extras (from API when available). */
export function getDiseasePlans() {
  return cachedPlans || fallbackPlans()
}

export function getDiseasePlanByCodeOrName(codeOrName) {
  if (!codeOrName) return null
  const key = String(codeOrName).trim()
  const plans = getDiseasePlans()
  return (
    plans.find((row) => row.code === key) ||
    plans.find((row) => row.nameVi.toLowerCase() === key.toLowerCase()) ||
    null
  )
}

export async function refreshDiseasePlansFromApi() {
  const result = await api.getDiseasePlans()
  cachedPlans = result.items || fallbackPlans()
  notify()
  return cachedPlans
}

/**
 * Append new actions per disease code via API.
 * @param {Record<string, string[]>} updates map code → new actions to add
 * @returns {Promise<{ added: number, skippedDup: number }>}
 */
export async function appendDiseaseActions(updates) {
  // Normalize client-side for UX counts before server round-trip
  const normalized = {}
  for (const [code, actions] of Object.entries(updates || {})) {
    const base = DISEASE_CATALOG.find((row) => row.code === code)
    if (!base || !Array.isArray(actions)) continue
    normalized[code] = actions.map(normalizeAction).filter(Boolean)
  }
  const result = await api.appendDiseasePlanActions(normalized)
  await refreshDiseasePlansFromApi()
  return result
}

/** Merge helper kept for any local preview before API. */
export function previewMergedActions(code, extraActions) {
  const base = DISEASE_CATALOG.find((row) => row.code === code)
  if (!base) return []
  return mergeActions(base.actions, extraActions || [])
}

export function actionDedupKey(text) {
  return actionKey(text)
}
