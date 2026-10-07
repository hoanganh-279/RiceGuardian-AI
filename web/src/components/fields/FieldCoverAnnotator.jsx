import { useEffect, useRef, useState } from 'react'

export function parseOutlinePoints(points) {
  if (!points) return []
  return String(points)
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number)
      return { x, y }
    })
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
}

export function toOutlinePoints(vertices) {
  return vertices.map((point) => `${Math.round(point.x * 10) / 10},${Math.round(point.y * 10) / 10}`).join(' ')
}

function imageContentBox(img) {
  const rect = img.getBoundingClientRect()
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (!nw || !nh || !rect.width || !rect.height) {
    return { left: 0, top: 0, width: rect.width, height: rect.height, naturalWidth: nw, naturalHeight: nh }
  }
  const scale = Math.min(rect.width / nw, rect.height / nh)
  const width = nw * scale
  const height = nh * scale
  return {
    left: (rect.width - width) / 2,
    top: (rect.height - height) / 2,
    width,
    height,
    naturalWidth: nw,
    naturalHeight: nh,
  }
}

function eventToPercent(event, img) {
  const rect = img.getBoundingClientRect()
  const box = imageContentBox(img)
  if (!box.width || !box.height) return null
  const x = event.clientX - rect.left - box.left
  const y = event.clientY - rect.top - box.top
  return {
    x: Math.min(100, Math.max(0, (x / box.width) * 100)),
    y: Math.min(100, Math.max(0, (y / box.height) * 100)),
  }
}

function normalizeRect(a, b) {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
}

function sourceSize(img) {
  if (img.naturalWidth && img.naturalHeight) {
    return { w: img.naturalWidth, h: img.naturalHeight }
  }
  const rect = img.getBoundingClientRect()
  return {
    w: Math.max(1, Math.round(rect.width)),
    h: Math.max(1, Math.round(rect.height)),
  }
}

function cropErrorMessage(err) {
  const raw = String(err?.message || err || '')
  if (/tainted|SecurityError|toBlob/i.test(raw)) {
    return 'Không xuất được ảnh cắt (CORS). Thử tải lại trang hoặc upload lại ảnh.'
  }
  return raw || 'Không cắt được ảnh.'
}

async function rasterizeCover(img) {
  const src = img.currentSrc || img.src
  if (!src) throw new Error('Không tìm thấy nguồn ảnh để cắt.')

  let response
  try {
    response = await fetch(src, { mode: 'cors', credentials: 'omit' })
  } catch {
    throw new Error('Không tải được ảnh để cắt. Kiểm tra kết nối hoặc CORS.')
  }
  if (!response.ok) {
    throw new Error('Không tải được ảnh để cắt.')
  }

  const blob = await response.blob()
  let bitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    throw new Error('Định dạng ảnh không hỗ trợ cắt.')
  }

  const w = bitmap.width || sourceSize(img).w
  const h = bitmap.height || sourceSize(img).h
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, w)
  canvas.height = Math.max(1, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Không cắt được ảnh.')
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

async function cropImageToBlob(img, rect) {
  const full = await rasterizeCover(img)
  const nw = full.width
  const nh = full.height
  const sx = (rect.x / 100) * nw
  const sy = (rect.y / 100) * nh
  const sw = (rect.w / 100) * nw
  const sh = (rect.h / 100) * nh
  if (sw < 8 || sh < 8) {
    throw new Error('Vùng cắt quá nhỏ.')
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sw))
  canvas.height = Math.max(1, Math.round(sh))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Không cắt được ảnh.')
  ctx.drawImage(full, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  let blob
  try {
    blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result)
        else reject(new Error('Không cắt được ảnh.'))
      }, 'image/jpeg', 0.9)
    })
  } catch (err) {
    throw new Error(cropErrorMessage(err))
  }
  return blob
}

function needsCrossOrigin(src) {
  if (!src || typeof src !== 'string') return false
  if (src.startsWith('/') || src.startsWith('blob:') || src.startsWith('data:')) return false
  try {
    const parsed = new URL(src, window.location.href)
    return parsed.origin !== window.location.origin
  } catch {
    return false
  }
}

export function FieldCoverAnnotator({
  src,
  alt,
  outline,
  maskUrl,
  canEdit,
  onCrop,
  onSaveOutline,
}) {
  const imgRef = useRef(null)
  const stageRef = useRef(null)
  const dragRef = useRef(null)
  const [mode, setMode] = useState('view')
  const [overlay, setOverlay] = useState({ left: 0, top: 0, width: '100%', height: '100%' })
  const [vertices, setVertices] = useState([])
  const [closed, setClosed] = useState(false)
  const [cropRect, setCropRect] = useState(null)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  const saved = parseOutlinePoints(outline?.points)

  function syncOverlay() {
    const img = imgRef.current
    const stage = stageRef.current
    if (!img || !stage) return
    const stageRect = stage.getBoundingClientRect()
    const imgRect = img.getBoundingClientRect()
    const box = imageContentBox(img)
    if (!stageRect.width || !stageRect.height || !box.width) return
    const left = imgRect.left - stageRect.left + box.left
    const top = imgRect.top - stageRect.top + box.top
    setOverlay({
      left: `${(left / stageRect.width) * 100}%`,
      top: `${(top / stageRect.height) * 100}%`,
      width: `${(box.width / stageRect.width) * 100}%`,
      height: `${(box.height / stageRect.height) * 100}%`,
    })
  }

  useEffect(() => {
    syncOverlay()
    const onResize = () => syncOverlay()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [src, maskUrl, mode])

  const displaySrc = mode === 'view' && maskUrl ? maskUrl : src

  function startDraw() {
    setLocalError('')
    setMode('draw')
    setCropRect(null)
    if (saved.length >= 3) {
      setVertices(saved)
      setClosed(true)
    } else {
      setVertices([])
      setClosed(false)
    }
  }

  function startCrop() {
    setLocalError('')
    setMode('crop')
    setCropRect(null)
    setVertices([])
    setClosed(false)
  }

  function cancelEdit() {
    setMode('view')
    setCropRect(null)
    setVertices([])
    setClosed(false)
    setLocalError('')
  }

  function addDrawVertex(event) {
    const img = imgRef.current
    if (!img) return
    const point = eventToPercent(event, img)
    if (!point) return
    setVertices((current) => [...current, point])
  }

  function onPointerDown(event) {
    if (mode !== 'crop') return
    const img = imgRef.current
    if (!img) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = eventToPercent(event, img)
    if (!point) return
    dragRef.current = point
    setCropRect({ x: point.x, y: point.y, w: 0, h: 0 })
  }

  function onPointerMove(event) {
    if (mode !== 'crop' || !dragRef.current) return
    const img = imgRef.current
    if (!img) return
    const point = eventToPercent(event, img)
    if (!point) return
    setCropRect(normalizeRect(dragRef.current, point))
  }

  function onPointerUp(event) {
    if (mode === 'crop') {
      dragRef.current = null
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        /* already released */
      }
      return
    }
    if (mode === 'draw' && !closed) {
      addDrawVertex(event)
    }
  }

  async function applyCrop() {
    const img = imgRef.current
    if (!img || !cropRect || cropRect.w < 1 || cropRect.h < 1) {
      setLocalError('Kéo một hình chữ nhật trên ảnh trước khi cắt.')
      return
    }
    setBusy(true)
    setLocalError('')
    try {
      const blob = await cropImageToBlob(img, cropRect)
      await onCrop(blob, cropRect)
      cancelEdit()
    } catch (err) {
      setLocalError(cropErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function saveOutline() {
    if (!closed || vertices.length < 3) {
      setLocalError('Thêm ít nhất 3 đỉnh rồi đóng ranh giới.')
      return
    }
    setBusy(true)
    setLocalError('')
    try {
      await onSaveOutline(toOutlinePoints(vertices))
      cancelEdit()
    } catch (err) {
      setLocalError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const draftPoints = toOutlinePoints(vertices)
  const viewPoints = toOutlinePoints(saved)

  return (
    <div className="rg-cover-annotator">
      <div className="rg-cover-annotator-stage" ref={stageRef}>
        <img
          ref={imgRef}
          src={displaySrc}
          alt={alt}
          draggable={false}
          crossOrigin={needsCrossOrigin(displaySrc) ? 'anonymous' : undefined}
          onLoad={syncOverlay}
        />
        <svg
          className={`rg-cover-annotator-svg rg-cover-annotator-svg--${mode}`}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={overlay}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {mode === 'view' && saved.length >= 3 ? (
            <polygon points={viewPoints} className="rg-cover-outline" />
          ) : null}
          {mode === 'draw' && vertices.length >= 2 ? (
            closed ? (
              <polygon points={draftPoints} className="rg-cover-outline rg-cover-outline--draft" />
            ) : (
              <polyline points={draftPoints} className="rg-cover-draft-line" />
            )
          ) : null}
          {mode === 'draw'
            ? vertices.map((point, index) => (
                <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="1.4" className="rg-cover-vertex" />
              ))
            : null}
          {mode === 'crop' && cropRect && cropRect.w > 0 && cropRect.h > 0 ? (
            <rect
              x={cropRect.x}
              y={cropRect.y}
              width={cropRect.w}
              height={cropRect.h}
              className="rg-cover-crop-rect"
            />
          ) : null}
        </svg>
      </div>
      {localError ? <p className="text-danger small mt-2 mb-0">{localError}</p> : null}
      {canEdit ? (
        <div className="d-flex flex-wrap gap-2 mt-2">
          {mode === 'view' ? (
            <>
              <button type="button" className="btn btn-sm btn-rg-ghost" onClick={startCrop}>
                Cắt ảnh
              </button>
              <button type="button" className="btn btn-sm btn-rg" onClick={startDraw}>
                Vẽ ranh giới
              </button>
            </>
          ) : null}
          {mode === 'crop' ? (
            <>
              <span className="small text-muted align-self-center">Kéo hình chữ nhật trên ảnh</span>
              <button type="button" className="btn btn-sm btn-rg" disabled={busy} onClick={applyCrop}>
                {busy ? 'Đang cắt…' : 'Áp dụng cắt'}
              </button>
              <button type="button" className="btn btn-sm btn-light" disabled={busy} onClick={cancelEdit}>
                Hủy
              </button>
            </>
          ) : null}
          {mode === 'draw' ? (
            <>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setVertices((current) => current.slice(0, -1))
                  setClosed(false)
                }}
                disabled={!vertices.length}
              >
                Undo
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setVertices([])
                  setClosed(false)
                }}
                disabled={!vertices.length}
              >
                Xóa đỉnh
              </button>
              <button
                type="button"
                className="btn btn-sm btn-rg-ghost"
                onClick={() => setClosed(true)}
                disabled={vertices.length < 3 || closed}
              >
                Đóng đa giác
              </button>
              <button type="button" className="btn btn-sm btn-rg" disabled={busy || !closed} onClick={saveOutline}>
                {busy ? 'Đang lưu…' : 'Lưu ranh giới'}
              </button>
              <button type="button" className="btn btn-sm btn-light" disabled={busy} onClick={cancelEdit}>
                Hủy
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
