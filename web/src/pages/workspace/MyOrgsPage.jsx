import { useAuth } from '../../context/AuthContext.jsx'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FEATURES } from '../../constants/features.js'

export default function MyOrgsPage() {
  const { organizations, selectedOrgIds, setOrgFilter } = useAuth()
  const filteredId = selectedOrgIds.length === 1 ? selectedOrgIds[0] : null
  const feature = FEATURES.A2

  return (
    <PageFrame code="A2 · Không gian làm việc" title={feature.title} description={feature.description}>
      {filteredId ? (
        <button type="button" className="btn btn-rg-ghost mb-3 px-0" onClick={() => setOrgFilter(null)}>
          Xem tất cả đơn vị
        </button>
      ) : null}
      <div>
        {organizations.map((org) => (
          <button
            type="button"
            key={org.id}
            className="rg-org-tile"
            onClick={() => setOrgFilter(org.id)}
          >
            <h2>{org.name}</h2>
            <div className="rg-meta">
              <span>{org.fieldCount} thửa phụ trách</span>
              <span>{org.unreadAlerts} cảnh báo chưa xử lý</span>
              <span>{org.unreadNotifications} thông báo chưa đọc</span>
              {filteredId === org.id ? <span>Đang lọc</span> : null}
            </div>
          </button>
        ))}
      </div>
    </PageFrame>
  )
}
