import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { ROLE_LABELS } from '../../constants/roles.js'
import { api, subscribeMockStore } from '../../services/api.js'
import { RiceMark } from '../RiceMark.jsx'
import { NotificationBell } from './NotificationBell.jsx'
import { OrgFilterBar } from './OrgFilterBar.jsx'
import { NAV, getSharedNav } from './navConfig.js'
import { METRIC_DASH } from '../../utils/metricDisplay.js'

function NavList({ items, onNavigate, badges = {} }) {
  const { organizations } = useAuth()
  return items
    .filter((item) => !item.when || item.when({ organizations }))
    .map((item) =>
      item.group ? (
        <div className="rg-nav-group" key={item.group}>
          {item.group}
        </div>
      ) : (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `rg-nav-link${isActive ? ' active' : ''}`}
          onClick={onNavigate}
        >
          {item.icon ? <i className={`bi bi-${item.icon} rg-nav-icon`} aria-hidden="true" /> : null}
          <span>{item.label}</span>
          {badges[item.to.split('?')[0]] || badges[item.to] ? (
            <span className="rg-nav-badge">{badges[item.to.split('?')[0]] || badges[item.to]}</span>
          ) : null}
        </NavLink>
      ),
    )
}

export function AppShell() {
  const { user, logout, selectedOrgIds } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [unread, setUnread] = useState(METRIC_DASH)
  const items = NAV[user.role] || []
  const sharedItems = getSharedNav(user.role)

  useEffect(() => {
    let alive = true
    function loadUnread() {
      api
        .getNotifications({ orgIds: selectedOrgIds, page: 1, limit: 1 })
        .then((result) => {
          if (alive) setUnread(result.unreadCount ?? METRIC_DASH)
        })
        .catch(() => {
          if (alive) setUnread(METRIC_DASH)
        })
    }
    loadUnread()
    const unsubscribe = subscribeMockStore(loadUnread)
    return () => {
      alive = false
      unsubscribe()
    }
  }, [selectedOrgIds])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const badges = { '/notifications': METRIC_DASH }

  return (
    <div className="rg-shell">
      {menuOpen ? (
        <button
          type="button"
          className="rg-sidebar-backdrop"
          aria-label="Đóng menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <aside className={`rg-sidebar${menuOpen ? ' open' : ''}`}>
        <div className="rg-sidebar-brand">
          <div className="rg-brand-mark">
            <RiceMark size={44} variant="circle" />
            <div className="rg-brand-lockup">
              <strong>
                RiceGuardian <span className="rg-brand-ai">AI</span>
              </strong>
              <span>Quản trị canh tác</span>
            </div>
          </div>
        </div>
        <nav className="flex-grow-1 overflow-auto">
          <NavList items={items} onNavigate={() => setMenuOpen(false)} badges={badges} />
          <NavList items={sharedItems} onNavigate={() => setMenuOpen(false)} badges={badges} />
        </nav>
        <button type="button" className="rg-menu-btn text-start mt-3 px-2" onClick={handleLogout}>
          <i className="bi bi-box-arrow-right rg-nav-icon" aria-hidden="true" />
          Đăng xuất
        </button>
      </aside>
      <div className="rg-main">
        <header className="rg-topbar">
          <button
            type="button"
            className="btn btn-rg-ghost rg-menu-toggle"
            onClick={() => setMenuOpen(true)}
            aria-label="Mở menu"
          >
            <i className="bi bi-list" />
          </button>
          <OrgFilterBar />
          <div className="rg-user-menu ms-auto">
            <NotificationBell unread={unread} />
            <div className="text-end">
              <div className="fw-semibold">{user.fullName}</div>
              <div className="small text-muted">{ROLE_LABELS[user.role]}</div>
            </div>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </header>
        <main className="rg-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
