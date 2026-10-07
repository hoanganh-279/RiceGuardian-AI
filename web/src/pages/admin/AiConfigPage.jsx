import { useEffect, useState } from 'react'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { FEATURES } from '../../constants/features.js'
import { SENSOR_METRICS } from '../../constants/sensors.js'
import { api } from '../../services/api.js'

export default function AiConfigPage() {
  const [config, setConfig] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  function load() {
    return api.getAiConfig().then(setConfig)
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [])

  function patch(group, key, nested, value) {
    const next = {
      ...config.staging,
      [group]: { ...config.staging[group], [nested]: Number(value) },
    }
    setConfig({ ...config, staging: next })
  }

  async function saveStaging(event) {
    event.preventDefault()
    const next = await api.updateAiStaging(config.staging)
    setConfig(next)
    setStatus('Đã lưu staging. Chưa áp dụng production.')
  }

  async function apply() {
    const next = await api.applyAiConfig()
    setConfig(next)
    setStatus('Đã áp dụng ngưỡng staging.')
  }

  if (!config) {
    return (
      <PageFrame code="B4" title={FEATURES.B4.title} description={FEATURES.B4.description}>
        {error ? <p className="text-danger">{error}</p> : <p>Đang tải…</p>}
      </PageFrame>
    )
  }

  return (
    <PageFrame
      code="B4"
      title={FEATURES.B4.title}
      description={FEATURES.B4.description}
      actions={
        <button type="button" className="btn btn-outline-secondary" onClick={apply}>
          Áp dụng staging
        </button>
      }
    >
      <FeatureMeta code="B4" />
      {error ? <p className="text-danger">{error}</p> : null}
      {status ? <p className="text-success">{status}</p> : null}
      <p className="small text-muted">Đang áp dụng từ {new Date(config.appliedAt).toLocaleString('vi-VN')}</p>
      <form onSubmit={saveStaging} style={{ maxWidth: '28rem' }}>
        {SENSOR_METRICS.map((metric) => (
          <fieldset key={metric.key} className="mb-3">
            <legend className="h6">
              {metric.label} ({metric.unit})
            </legend>
            <div className="d-flex gap-2">
              <input
                className="form-control"
                type="number"
                value={config.staging[metric.key].min}
                onChange={(event) => patch(metric.key, 'min', 'min', event.target.value)}
              />
              <input
                className="form-control"
                type="number"
                value={config.staging[metric.key].max}
                onChange={(event) => patch(metric.key, 'max', 'max', event.target.value)}
              />
            </div>
          </fieldset>
        ))}
        <button type="submit" className="btn btn-rg">
          Lưu staging
        </button>
      </form>
    </PageFrame>
  )
}
