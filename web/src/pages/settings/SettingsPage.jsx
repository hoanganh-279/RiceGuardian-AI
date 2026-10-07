import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { FEATURES } from '../../constants/features.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'

const ADMIN_ADVANCED_LINKS = [
  { to: '/admin/organizations', label: 'Quản lý đơn vị', code: 'B2' },
  { to: '/admin/assignments', label: 'Phân công kỹ thuật viên', code: 'B8' },
  { to: '/admin/ai-config', label: 'Ngưỡng & mô hình AI', code: 'B4' },
  { to: '/admin/system', label: 'Giám sát hệ thống', code: 'B5' },
  { to: '/admin/training', label: 'Dữ liệu huấn luyện AI', code: 'B6' },
  { to: '/profile', label: 'Hồ sơ cá nhân', code: 'A3' },
  { to: '/search', label: 'Tìm kiếm', code: 'E2' },
]

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const [settings, setSettings] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getSettings()
      .then(setSettings)
      .catch((err) => setError(err.message))
  }, [])

  async function save(patch) {
    setError('')
    const next = await api.updateSettings(patch)
    setSettings(next)
    setStatus('Đã lưu trên trình duyệt này.')
  }

  if (!settings) {
    return (
      <PageFrame code="E3" title={FEATURES.E3.title} description={FEATURES.E3.description}>
        {error ? <p className="text-danger">{error}</p> : <p className="text-muted">Đang tải…</p>}
      </PageFrame>
    )
  }

  return (
    <PageFrame code="E3" title={FEATURES.E3.title} description={FEATURES.E3.description}>
      <FeatureMeta code="E3" />
      {status ? <p className="text-success">{status}</p> : null}
      {error ? <p className="text-danger">{error}</p> : null}

      <label className="form-label" htmlFor="language">
        Ngôn ngữ
      </label>
      <select
        id="language"
        className="form-select mb-3"
        style={{ maxWidth: '22rem' }}
        value={settings.language}
        onChange={(event) => save({ language: event.target.value })}
      >
        <option value="vi">Tiếng Việt</option>
      </select>

      <label className="form-label" htmlFor="timezone">
        Múi giờ
      </label>
      <select
        id="timezone"
        className="form-select mb-3"
        style={{ maxWidth: '22rem' }}
        value={settings.timezone}
        onChange={(event) => save({ timezone: event.target.value })}
      >
        <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</option>
        <option value="Asia/Bangkok">Asia/Bangkok</option>
      </select>

      <div className="form-check mb-2">
        <input
          id="notifyAlerts"
          className="form-check-input"
          type="checkbox"
          checked={settings.notifyAlerts}
          onChange={(event) => save({ notifyAlerts: event.target.checked })}
        />
        <label className="form-check-label" htmlFor="notifyAlerts">
          Thông báo cảnh báo bệnh hại
        </label>
      </div>
      <div className="form-check mb-4">
        <input
          id="notifySystem"
          className="form-check-input"
          type="checkbox"
          checked={settings.notifySystem}
          onChange={(event) => save({ notifySystem: event.target.checked })}
        />
        <label className="form-check-label" htmlFor="notifySystem">
          Thông báo hệ thống
        </label>
      </div>

      {isAdmin ? (
        <>
          <h2 className="h5">Hệ thống (Admin)</h2>
          <div className="form-check mb-2">
            <input
              id="maintenanceMode"
              className="form-check-input"
              type="checkbox"
              checked={settings.maintenanceMode}
              onChange={(event) => save({ maintenanceMode: event.target.checked })}
            />
            <label className="form-check-label" htmlFor="maintenanceMode">
              Chế độ bảo trì (mock)
            </label>
          </div>
          <div className="form-check mb-4">
            <input
              id="allowNewOrgs"
              className="form-check-input"
              type="checkbox"
              checked={settings.allowNewOrgs}
              onChange={(event) => save({ allowNewOrgs: event.target.checked })}
            />
            <label className="form-check-label" htmlFor="allowNewOrgs">
              Cho phép tạo đơn vị mới
            </label>
          </div>

          <h2 className="h5">Quản trị nâng cao</h2>
          <p className="small text-muted">Các trang không còn trên sidebar — vẫn mở được từ đây.</p>
          <ul className="list-unstyled mb-0">
            {ADMIN_ADVANCED_LINKS.map((item) => (
              <li key={item.to} className="mb-2">
                <Link to={item.to} className="text-decoration-none">
                  {item.label}
                </Link>
                <span className="small text-muted ms-2">{item.code}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </PageFrame>
  )
}
