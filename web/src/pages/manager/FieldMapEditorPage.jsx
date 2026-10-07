import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'

const VIEWBOX = { w: 640, h: 360 }

function parseSvgPoints(points) {
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

function toSvgPoints(vertices) {
  return vertices.map((point) => `${Math.round(point.x * 10) / 10},${Math.round(point.y * 10) / 10}`).join(' ')
}

function svgPointFromEvent(event, svg) {
  const pt = svg.createSVGPoint()
  pt.x = event.clientX
  pt.y = event.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const loc = pt.matrixTransform(ctm.inverse())
  return {
    x: Math.min(VIEWBOX.w, Math.max(0, loc.x)),
    y: Math.min(VIEWBOX.h, Math.max(0, loc.y)),
  }
}

export default function FieldMapEditorPage() {
  const { fieldId } = useParams()
  const isEdit = Boolean(fieldId)
  const navigate = useNavigate()
  const svgRef = useRef(null)
  const { selectedOrgIds, organizations } = useAuth()
  const [fields, setFields] = useState([])
  const [farmers, setFarmers] = useState([])
  const [vertices, setVertices] = useState([])
  const [closed, setClosed] = useState(false)
  const [form, setForm] = useState({
    orgId: '',
    name: '',
    areaHa: '',
    variety: '',
    farmerIds: [],
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([api.getAssignedFields(selectedOrgIds), api.getFarmers(selectedOrgIds)])
      .then(([fieldRows, farmerRows]) => {
        if (!alive) return
        setFields(fieldRows)
        setFarmers(farmerRows)
        const current = fieldRows.find((row) => row.id === fieldId)
        const defaultOrg = organizations[0]?.id || fieldRows[0]?.orgId || ''
        if (current) {
          const pts = parseSvgPoints(current.points)
          setVertices(pts)
          setClosed(pts.length >= 3)
          setForm({
            orgId: current.orgId,
            name: current.name,
            areaHa: String(current.areaHa ?? ''),
            variety: current.variety || '',
            farmerIds: farmerRows.filter((row) => (row.fieldIds || []).includes(current.id)).map((row) => row.id),
          })
        } else {
          setForm((prev) => ({ ...prev, orgId: prev.orgId || defaultOrg }))
        }
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [fieldId, selectedOrgIds, organizations])

  const others = useMemo(
    () => fields.filter((row) => row.id !== fieldId && row.points),
    [fields, fieldId],
  )
  const orgFarmers = farmers.filter((row) => !form.orgId || row.orgId === form.orgId)
  const draftPoints = toSvgPoints(vertices)

  function addVertex(event) {
    if (closed) return
    const svg = svgRef.current
    if (!svg) return
    const point = svgPointFromEvent(event, svg)
    if (!point) return
    setVertices((current) => [...current, point])
  }

  async function handleSave(event) {
    event.preventDefault()
    setError('')
    if (vertices.length < 3) {
      setError('Vẽ ít nhất 3 đỉnh ranh giới.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        orgId: form.orgId,
        name: form.name,
        areaHa: Number(form.areaHa),
        variety: form.variety,
        points: toSvgPoints(vertices),
        farmerIds: form.farmerIds,
      }
      if (isEdit) {
        await api.updateField(fieldId, payload)
        await api.setFieldFarmers(fieldId, form.farmerIds)
      } else {
        await api.createField(payload)
      }
      navigate('/manager/fields')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  function toggleFarmer(id) {
    setForm((current) => {
      const has = current.farmerIds.includes(id)
      return {
        ...current,
        farmerIds: has ? current.farmerIds.filter((item) => item !== id) : [...current.farmerIds, id],
      }
    })
  }

  return (
    <PageFrame
      code="C3"
      title={isEdit ? 'Sửa ranh giới thửa' : 'Tạo thửa ruộng'}
      description="Click bản đồ để thêm đỉnh polygon. Tối thiểu 3 điểm rồi đóng ranh giới trước khi lưu."
      actions={
        <Link className="btn btn-rg-ghost" to="/manager/fields">
          Về danh sách
        </Link>
      }
    >
      <FeatureMeta code="C3" />
      {error ? <p className="text-danger">{error}</p> : null}
      <div className="rg-map-canvas rg-map-editor mb-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
          className="rg-map-svg"
          onClick={addVertex}
        >
          {others.map((item) => (
            <polygon key={item.id} points={item.points} className="rg-map-poly rg-map-poly-bg" />
          ))}
          {vertices.length >= 2 ? (
            closed ? (
              <polygon points={draftPoints} className="rg-map-poly rg-map-poly-draft" />
            ) : (
              <polyline points={draftPoints} className="rg-map-draft-line" />
            )
          ) : null}
          {vertices.map((point, index) => (
            <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="5" className="rg-map-vertex" />
          ))}
        </svg>
      </div>
      <div className="d-flex flex-wrap gap-2 mb-3">
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
          className="btn btn-sm btn-rg"
          onClick={() => setClosed(true)}
          disabled={vertices.length < 3 || closed}
        >
          Đóng polygon
        </button>
        <span className="small text-muted align-self-center">{vertices.length} đỉnh</span>
      </div>
      <form onSubmit={handleSave} style={{ maxWidth: '32rem' }}>
        {organizations.length > 1 ? (
          <>
            <label className="form-label" htmlFor="fld-org">
              Đơn vị
            </label>
            <select
              id="fld-org"
              className="form-select mb-2"
              required
              value={form.orgId}
              onChange={(event) => setForm({ ...form, orgId: event.target.value, farmerIds: [] })}
              disabled={isEdit}
            >
              <option value="">Chọn đơn vị</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <label className="form-label" htmlFor="fld-name">
          Tên thửa
        </label>
        <input
          id="fld-name"
          className="form-control mb-2"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <label className="form-label" htmlFor="fld-area">
          Diện tích (ha)
        </label>
        <input
          id="fld-area"
          className="form-control mb-2"
          type="number"
          step="0.1"
          min="0"
          required
          value={form.areaHa}
          onChange={(event) => setForm({ ...form, areaHa: event.target.value })}
        />
        <label className="form-label" htmlFor="fld-variety">
          Giống
        </label>
        <input
          id="fld-variety"
          className="form-control mb-3"
          value={form.variety}
          onChange={(event) => setForm({ ...form, variety: event.target.value })}
        />
        <p className="form-label">Hộ nông dân liên kết</p>
        <div className="mb-3">
          {orgFarmers.length === 0 ? (
            <p className="small text-muted">Chưa có hộ trong đơn vị này.</p>
          ) : (
            orgFarmers.map((farmer) => (
              <label key={farmer.id} className="d-flex gap-2 align-items-center mb-1">
                <input
                  type="checkbox"
                  checked={form.farmerIds.includes(farmer.id)}
                  onChange={() => toggleFarmer(farmer.id)}
                />
                <span>
                  {farmer.fullName} · {farmer.phone}
                </span>
              </label>
            ))
          )}
        </div>
        <div className="d-flex gap-2">
          <Link className="btn btn-light" to="/manager/fields">
            Hủy
          </Link>
          <button type="submit" className="btn btn-rg" disabled={saving || vertices.length < 3}>
            {saving ? 'Đang lưu…' : 'Lưu thửa'}
          </button>
        </div>
      </form>
    </PageFrame>
  )
}
