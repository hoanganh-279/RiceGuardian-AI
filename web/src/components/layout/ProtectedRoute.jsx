import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { homePath } from './navConfig.js'

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

export function GuestRoute({ children }) {
  const { isAuthenticated, user } = useAuth()
  if (isAuthenticated) return <Navigate to={homePath(user.role)} replace />
  return children
}

export function RoleRoute({ roles }) {
  const { user } = useAuth()
  if (!roles.includes(user.role)) return <Navigate to={homePath(user.role)} replace />
  return <Outlet />
}
