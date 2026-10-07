import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export function OrgFilterBar() {
  const { isTechnician, organizations, selectedOrgIds, setOrgFilter } = useAuth()
  if (!isTechnician || organizations.length < 2) return null

  const filtered =
    selectedOrgIds.length === 1
      ? organizations.find((org) => org.id === selectedOrgIds[0])
      : null

  return (
    <div className="d-flex flex-wrap align-items-center gap-2">
      <span className="rg-org-chip">
        {filtered ? filtered.name : `Tất cả ${organizations.length} đơn vị`}
        {filtered ? (
          <button type="button" onClick={() => setOrgFilter(null)}>
            Xem tất cả đơn vị
          </button>
        ) : null}
      </span>
      <Link to="/my-orgs" className="small text-decoration-none">
        Đơn vị của tôi
      </Link>
    </div>
  )
}
