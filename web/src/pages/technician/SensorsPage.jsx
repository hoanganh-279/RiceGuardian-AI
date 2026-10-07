import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { SensorReadingsTable } from '../../components/stations/SensorReadingsTable.jsx'
import { DetailHeader } from '../../components/workspace/DetailHeader.jsx'
import { MasterDetailLayout } from '../../components/workspace/MasterDetailLayout.jsx'
import { MasterItem, MasterList } from '../../components/workspace/MasterList.jsx'
import { StatusPill } from '../../components/workspace/StatusPill.jsx'
import { FEATURES } from '../../constants/features.js'
import { stationManagePath } from '../../constants/sensors.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'
import { METRIC_DASH } from '../../utils/metricDisplay.js'

export default function SensorsPage() {
  const { selectedOrgIds, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const stationId = searchParams.get('stationId') || ''
  const [payload, setPayload] = useState({ stations: [], items: [], thresholds: null })
  const [error, setError] = useState('')

  useEffect(() => {
    if (user.role === 'admin') return undefined
    let alive = true
    api
      .getSensorReadings({ orgIds: selectedOrgIds, stationId: stationId || undefined })
      .then((result) => {
        if (!alive) return
        setPayload(result)
        if (!stationId && result.stations[0]) {
          setSearchParams({ stationId: result.stations[0].id }, { replace: true })
        }
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [selectedOrgIds, stationId, setSearchParams, user.role])

  if (user.role === 'admin') {
    const to = stationId
      ? `/admin/devices/${encodeURIComponent(stationId)}?tab=sensors`
      : '/admin/devices'
    return <Navigate to={to} replace />
  }

  const station = payload.stations.find((row) => row.id === stationId)
  const items = station ? payload.items.filter((row) => row.stationId === stationId) : []
  const managePath = stationManagePath(user.role, stationId)

  return (
    <PageFrame code="D5" title={FEATURES.D5.title} description={FEATURES.D5.description}>
      <FeatureMeta code="D5" />
      {error ? <p className="text-danger">{error}</p> : null}
      <MasterDetailLayout
        master={
          <MasterList title="Trạm IoT" isEmpty={payload.stations.length === 0}>
            {payload.stations.map((item) => (
              <MasterItem
                key={item.id}
                active={stationId === item.id}
                onClick={() => setSearchParams({ stationId: item.id })}
                title={item.code}
                subtitle={item.name}
                meta={`${item.fieldName} · Pin ${METRIC_DASH}`}
                badge={
                  <StatusPill tone={item.online ? 'success' : 'danger'}>{item.online ? 'Online' : 'Offline'}</StatusPill>
                }
              />
            ))}
          </MasterList>
        }
        detail={
          <>
            <DetailHeader
              empty={!station}
              title={station ? `${station.code} · ${station.name}` : ''}
              meta={station ? `${station.orgName} / ${station.fieldName}` : ''}
              actions={
                managePath ? (
                  <Link className="btn btn-sm btn-rg-outline" to={managePath}>
                    Xem trạm
                  </Link>
                ) : null
              }
            />
            {station ? (
              <div className="rg-md-detail-body">
                <SensorReadingsTable key={stationId} items={items} thresholds={payload.thresholds} />
              </div>
            ) : null}
          </>
        }
      />
    </PageFrame>
  )
}
