import { useEffect, useState } from 'react'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { SystemHealthDashboard } from '../../components/system/SystemHealthDashboard.jsx'
import { FEATURES } from '../../constants/features.js'
import { api } from '../../services/api.js'

export default function SystemMonitorPage() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    function load() {
      api
        .getSystemHealth()
        .then((result) => {
          if (alive) setHealth(result)
        })
        .catch((err) => {
          if (alive) setError(err.message)
        })
    }
    load()
    const timer = setInterval(load, 10000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  return (
    <PageFrame code="B5" title={FEATURES.B5.title} description={FEATURES.B5.description}>
      <SystemHealthDashboard health={health} error={error} />
    </PageFrame>
  )
}
