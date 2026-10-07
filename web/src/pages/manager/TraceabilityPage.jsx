import { useEffect, useState } from 'react'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { FEATURES } from '../../constants/features.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'

export default function TraceabilityPage() {
  const { selectedOrgIds } = useAuth()
  const [fields, setFields] = useState([])
  const [seasons, setSeasons] = useState([])
  const [fieldId, setFieldId] = useState('')
  const [seasonId, setSeasonId] = useState('')
  const [format, setFormat] = useState('csv')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.getAssignedFields(selectedOrgIds),
      api.getSeasonReports({ orgIds: selectedOrgIds }),
    ])
      .then(([fieldRows, report]) => {
        setFields(fieldRows)
        setSeasons(report.seasons)
        if (!seasonId && report.season) setSeasonId(report.season.id)
      })
      .catch((err) => setError(err.message))
  }, [selectedOrgIds])

  async function handleExport(event) {
    event.preventDefault()
    setError('')
    const file = await api.exportTraceability({ fieldId, seasonId, format })
    const blob = new Blob([file.body], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.filename
    link.click()
    URL.revokeObjectURL(url)
    setStatus(`Đã tải ${file.filename}`)
  }

  return (
    <PageFrame code="C5" title={FEATURES.C5.title} description={FEATURES.C5.description}>
      <FeatureMeta code="C5" />
      {error ? <p className="text-danger">{error}</p> : null}
      {status ? <p className="text-success">{status}</p> : null}
      <form onSubmit={handleExport} style={{ maxWidth: '28rem' }}>
        <label className="form-label" htmlFor="tr-field">
          Thửa
        </label>
        <select
          id="tr-field"
          className="form-select mb-2"
          required
          value={fieldId}
          onChange={(event) => setFieldId(event.target.value)}
        >
          <option value="">Chọn thửa</option>
          {fields.map((field) => (
            <option key={field.id} value={field.id}>
              {field.name}
            </option>
          ))}
        </select>
        <label className="form-label" htmlFor="tr-season">
          Mùa vụ
        </label>
        <select
          id="tr-season"
          className="form-select mb-2"
          required
          value={seasonId}
          onChange={(event) => setSeasonId(event.target.value)}
        >
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
            </option>
          ))}
        </select>
        <label className="form-label" htmlFor="tr-format">
          Định dạng
        </label>
        <select
          id="tr-format"
          className="form-select mb-3"
          value={format}
          onChange={(event) => setFormat(event.target.value)}
        >
          <option value="csv">CSV</option>
          <option value="txt">TXT</option>
        </select>
        <button type="submit" className="btn btn-rg">
          Xuất báo cáo
        </button>
      </form>
    </PageFrame>
  )
}
