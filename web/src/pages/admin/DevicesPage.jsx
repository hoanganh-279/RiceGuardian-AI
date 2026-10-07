import { useEffect, useState } from 'react'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { StationFormModal } from '../../components/stations/StationFormModal.jsx'
import { StationGrid } from '../../components/stations/StationCard.jsx'
import { FEATURES } from '../../constants/features.js'
import { stationManagePath, stationSensorsPath } from '../../constants/sensors.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'

export default function DevicesPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [fields, setFields] = useState([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  function load() {
    return Promise.all([api.getDevices(), api.getAssignedFields()]).then(([devices, fieldRows]) => {
      setItems(devices)
      setFields(fieldRows)
    })
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [])

  return (
    <PageFrame
      code="B3"
      title={FEATURES.B3.title}
      description={FEATURES.B3.description}
      actions={
        <button type="button" className="btn btn-rg" onClick={() => setCreating(true)}>
          Thêm trạm
        </button>
      }
    >
      <FeatureMeta code="B3" />
      {error ? <p className="text-danger">{error}</p> : null}
      <StationGrid
        stations={items}
        role={user.role}
        sensorsPath={stationSensorsPath}
        managePath={stationManagePath}
      />
      {creating ? (
        <StationFormModal
          title="Thêm thiết bị IoT"
          fields={fields.filter((field) => !items.some((row) => row.fieldId === field.id))}
          onClose={() => setCreating(false)}
          onSubmit={async (payload) => {
            await api.createStation(payload)
            setCreating(false)
            await load()
          }}
        />
      ) : null}
    </PageFrame>
  )
}
