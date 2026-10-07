import { useEffect, useState } from 'react'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { FEATURES } from '../../constants/features.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'
import { METRIC_DASH } from '../../utils/metricDisplay.js'

export default function SeasonReportsPage() {
  const { selectedOrgIds } = useAuth()
  const [seasonId, setSeasonId] = useState('')
  const [payload, setPayload] = useState({ seasons: [], items: [], season: null })
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getSeasonReports({ orgIds: selectedOrgIds, seasonId: seasonId || undefined })
      .then((result) => {
        setPayload(result)
        if (!seasonId) setSeasonId(result.season.id)
      })
      .catch((err) => setError(err.message))
  }, [selectedOrgIds, seasonId])

  return (
    <PageFrame
      code="C4"
      title={FEATURES.C4.title}
      description={FEATURES.C4.description}
      filters={
        <div className="rg-filter-row mb-3">
          {payload.seasons.map((season) => (
            <button
              key={season.id}
              type="button"
              className={`rg-pill${seasonId === season.id ? ' active' : ''}`}
              onClick={() => setSeasonId(season.id)}
            >
              {season.name}
            </button>
          ))}
        </div>
      }
    >
      <FeatureMeta code="C4" />
      {error ? <p className="text-danger">{error}</p> : null}
      <div className="table-responsive">
        <table className="rg-table">
          <thead>
            <tr>
              <th>Đơn vị</th>
              <th>Diện tích</th>
              <th>Thửa</th>
              <th>Cảnh báo</th>
              <th>Nhật ký</th>
            </tr>
          </thead>
          <tbody>
            {payload.items.map((row) => (
              <tr key={row.orgId}>
                <td>{row.orgName}</td>
                <td>{METRIC_DASH}</td>
                <td>{row.fields}</td>
                <td>{row.alerts}</td>
                <td>{row.logs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageFrame>
  )
}
