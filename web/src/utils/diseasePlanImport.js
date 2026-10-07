import * as XLSX from 'xlsx'
import { DISEASE_CATALOG } from '../data/diseaseCatalog.js'
import { normalizeAction } from '../data/diseasePlanOverlay.js'

function normalizeSheetKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * @param {ArrayBuffer} arrayBuffer
 * @returns {{ workbook: import('xlsx').WorkBook, sheetNames: string[] }}
 */
export function listSheets(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  return {
    workbook,
    sheetNames: workbook.SheetNames || [],
  }
}

/**
 * First non-empty cell on each row becomes one treatment action.
 * @param {import('xlsx').WorkBook} workbook
 * @param {string} sheetName
 * @returns {string[]}
 */
export function parseSheetActions(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
  const actions = []
  for (const row of rows) {
    if (!Array.isArray(row)) continue
    for (const cell of row) {
      const text = normalizeAction(cell)
      if (text) {
        actions.push(text)
        break
      }
    }
  }
  return actions
}

/**
 * Match sheet name to catalog by code or Vietnamese name.
 * @param {string} sheetName
 * @param {typeof DISEASE_CATALOG} [catalog]
 */
export function matchDisease(sheetName, catalog = DISEASE_CATALOG) {
  const key = normalizeSheetKey(sheetName)
  if (!key) return null
  return (
    catalog.find((row) => normalizeSheetKey(row.code) === key) ||
    catalog.find((row) => normalizeSheetKey(row.nameVi) === key) ||
    null
  )
}

/**
 * @param {{ sheetName: string, actions: string[] }[]} sheetImports
 * @param {typeof DISEASE_CATALOG} [catalog]
 * @returns {{
 *   updates: Record<string, string[]>,
 *   unmatchedSheets: string[],
 *   matchedSheets: { sheetName: string, code: string, nameVi: string, actionCount: number }[]
 * }}
 */
export function buildImportUpdates(sheetImports, catalog = DISEASE_CATALOG) {
  const updates = {}
  const unmatchedSheets = []
  const matchedSheets = []

  for (const item of sheetImports) {
    const disease = matchDisease(item.sheetName, catalog)
    if (!disease) {
      unmatchedSheets.push(item.sheetName)
      continue
    }
    const actions = (item.actions || []).map(normalizeAction).filter(Boolean)
    if (!updates[disease.code]) updates[disease.code] = []
    updates[disease.code].push(...actions)
    matchedSheets.push({
      sheetName: item.sheetName,
      code: disease.code,
      nameVi: disease.nameVi,
      actionCount: actions.length,
    })
  }

  return { updates, unmatchedSheets, matchedSheets }
}

/**
 * @param {ArrayBuffer} arrayBuffer
 * @param {string[]} selectedSheetNames
 */
export function prepareImportFromFile(arrayBuffer, selectedSheetNames) {
  const { workbook, sheetNames } = listSheets(arrayBuffer)
  const selected = selectedSheetNames.length
    ? selectedSheetNames
    : sheetNames
  const sheetImports = selected.map((sheetName) => ({
    sheetName,
    actions: parseSheetActions(workbook, sheetName),
  }))
  return {
    sheetNames,
    ...buildImportUpdates(sheetImports),
  }
}
