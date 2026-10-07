const STORAGE_KEY = 'rg_disease_plan_actions_v1'

export function normalizeAction(text) {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function actionKey(text) {
  return normalizeAction(text).toLowerCase()
}

export function readDiseaseActionOverlay() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out = {}
    for (const [code, actions] of Object.entries(parsed)) {
      if (!Array.isArray(actions)) continue
      out[code] = actions.map(normalizeAction).filter(Boolean)
    }
    return out
  } catch {
    return {}
  }
}

export function writeDiseaseActionOverlay(overlay) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay))
}

export function mergeActions(baseActions, extraActions) {
  const merged = [...(baseActions || [])]
  const seen = new Set(merged.map(actionKey))
  for (const raw of extraActions || []) {
    const action = normalizeAction(raw)
    const key = actionKey(action)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(action)
  }
  return merged
}
