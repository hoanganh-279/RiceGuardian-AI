import { useEffect, useRef, useState } from 'react'
import { DISEASE_CATALOG } from '../../data/diseaseCatalog.js'
import { appendDiseaseActions } from '../../data/diseasePlansStore.js'
import { listSheets, matchDisease, prepareImportFromFile } from '../../utils/diseasePlanImport.js'

const ACCEPT = '.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12'

function isExcelFile(file) {
  if (!file) return false
  const name = String(file.name || '').toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.xlsm')
}

export function DiseasePlanImportModal({ onClose, onImported }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [buffer, setBuffer] = useState(null)
  const [sheets, setSheets] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function loadFile(nextFile) {
    setError('')
    if (!nextFile) return
    if (!isExcelFile(nextFile)) {
      setError('Chỉ chấp nhận file .xlsx hoặc .xlsm.')
      setFile(null)
      setBuffer(null)
      setSheets([])
      setSelected(new Set())
      return
    }
    try {
      const arrayBuffer = await nextFile.arrayBuffer()
      const { sheetNames } = listSheets(arrayBuffer)
      const auto = new Set(
        sheetNames.filter((name) => matchDisease(name, DISEASE_CATALOG)),
      )
      setFile(nextFile)
      setBuffer(arrayBuffer)
      setSheets(sheetNames)
      setSelected(auto.size > 0 ? auto : new Set(sheetNames))
    } catch (err) {
      setError(err.message || 'Không đọc được file Excel.')
      setFile(null)
      setBuffer(null)
      setSheets([])
      setSelected(new Set())
    }
  }

  function toggleSheet(name) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  async function handleProcess() {
    if (!buffer || selected.size === 0 || busy) return
    setBusy(true)
    setError('')
    try {
      const { updates, unmatchedSheets, matchedSheets } = prepareImportFromFile(
        buffer,
        [...selected],
      )
      const { added, skippedDup } = await appendDiseaseActions(updates)
      onImported?.({
        added,
        skippedDup,
        unmatchedSheets,
        matchedSheets,
        fileName: file?.name || '',
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Xử lý dữ liệu thất bại.')
    } finally {
      setBusy(false)
    }
  }

  const canProcess = Boolean(buffer && selected.size > 0 && !busy)

  return (
    <div className="rg-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="rg-import-modal"
        role="dialog"
        aria-labelledby="rg-import-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="rg-import-modal__header">
          <h2 id="rg-import-modal-title" className="rg-import-modal__title">
            Tải lên File Import
          </h2>
          <button type="button" className="rg-import-modal__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>

        <div className="rg-import-modal__body">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="visually-hidden"
            onChange={(event) => loadFile(event.target.files?.[0])}
          />

          <button
            type="button"
            className={`rg-import-dropzone${dragging ? ' is-dragging' : ''}${file ? ' has-file' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              loadFile(event.dataTransfer.files?.[0])
            }}
          >
            <span className="rg-import-dropzone__icon" aria-hidden="true">
              <i className="bi bi-file-earmark-excel-fill" />
            </span>
            <span className="rg-import-dropzone__label">
              {file ? file.name : 'Kéo thả hoặc chọn file .xlsx / .xlsm'}
            </span>
            <span className="rg-import-dropzone__hint">
              Hệ thống sẽ quét danh sách sheet sau khi chọn file
            </span>
          </button>

          {sheets.length > 0 ? (
            <div className="rg-import-sheets">
              <p className="rg-import-sheets__title">Danh sách sheet ({sheets.length})</p>
              <ul className="rg-import-sheets__list">
                {sheets.map((name) => {
                  const matched = matchDisease(name, DISEASE_CATALOG)
                  return (
                    <li key={name}>
                      <label className="rg-import-sheets__item">
                        <input
                          type="checkbox"
                          checked={selected.has(name)}
                          onChange={() => toggleSheet(name)}
                        />
                        <span className="rg-import-sheets__name">{name}</span>
                        {matched ? (
                          <span className="rg-import-sheets__badge">→ {matched.nameVi}</span>
                        ) : (
                          <span className="rg-import-sheets__badge is-warn">Không khớp bệnh</span>
                        )}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {error ? <p className="text-danger small mb-0 mt-2">{error}</p> : null}
        </div>

        <footer className="rg-import-modal__footer">
          <button
            type="button"
            className="btn rg-import-process-btn"
            disabled={!canProcess}
            onClick={handleProcess}
          >
            <i className="bi bi-gear-fill" aria-hidden="true" />
            {busy ? 'Đang xử lý…' : 'Xử lý dữ liệu'}
          </button>
        </footer>
      </div>
    </div>
  )
}
