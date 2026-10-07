import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { notificationKindLabel, stationManagePath } from '../../constants/sensors.js'
import { api, subscribeMockStore } from '../../services/api.js'
import { METRIC_DASH } from '../../utils/metricDisplay.js'

function formatWhen(iso) {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export function NotificationBell({ unread }) {
  const { user, selectedOrgIds } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const rootRef = useRef(null)

  useEffect(() => {
    let alive = true
    function load() {
      api
        .getNotifications({ orgIds: selectedOrgIds, page: 1, limit: 8 })
        .then((result) => {
          if (alive) setItems(result.items.filter((row) => !row.read).slice(0, 5))
        })
        .catch(() => {
          if (alive) setItems([])
        })
    }
    load()
    const unsubscribe = subscribeMockStore(load)
    return () => {
      alive = false
      unsubscribe()
    }
  }, [selectedOrgIds])

  useEffect(() => {
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [])

  async function openItem(item) {
    if (!item.read) {
      try {
        await api.markNotificationRead(item.id)
      } catch {
        /* keep navigating */
      }
    }
    setOpen(false)
    const path =
      item.kind === 'station_fault' ? stationManagePath(user.role, item.stationId) : '/notifications'
    navigate(path || '/notifications')
  }

  return (
    <div className="rg-notify-wrap" ref={rootRef}>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary rg-notify-bell"
        aria-label="Thông báo"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <i className="bi bi-bell" />
        <span className="rg-notify-badge">{METRIC_DASH}</span>
      </button>
      {open ? (
        <div className="rg-notify-dropdown" role="menu">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>Thông báo</strong>
            <button
              type="button"
              className="btn btn-link btn-sm p-0"
              onClick={() => {
                setOpen(false)
                navigate('/notifications')
              }}
            >
              Xem tất cả
            </button>
          </div>
          {items.length ? (
            items.map((item) => (
              <button key={item.id} type="button" className="rg-notify-item" onClick={() => openItem(item)}>
                <span className="rg-org-label">{notificationKindLabel(item.kind)}</span>
                <strong>{item.title}</strong>
                <small>{formatWhen(item.createdAt)}</small>
              </button>
            ))
          ) : (
            <p className="small text-muted mb-0">Không có tin chưa đọc.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
