import { createContext, useContext, useMemo, useState } from 'react'
import { api } from '../services/api.js'
import {
  getSelectedOrgIds,
  getSession,
  getToken,
  setSelectedOrgIds,
} from '../services/authStorage.js'

const AuthContext = createContext(null)

function initialState() {
  const token = getToken()
  const session = getSession()
  if (!token || !session?.user) {
    return { user: null, organizations: [], selectedOrgIds: [] }
  }
  const allIds = session.organizations.map((org) => org.id)
  const stored = getSelectedOrgIds(allIds).filter((id) => allIds.includes(id))
  return {
    user: session.user,
    organizations: session.organizations,
    selectedOrgIds: stored.length ? stored : allIds,
  }
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialState)

  const value = useMemo(() => {
    const allIds = state.organizations.map((org) => org.id)
    const setOrgFilter = (orgId) => {
      const next = orgId ? [orgId] : allIds
      setSelectedOrgIds(next)
      setState((prev) => ({ ...prev, selectedOrgIds: next }))
    }

    return {
      user: state.user,
      organizations: state.organizations,
      selectedOrgIds: state.selectedOrgIds,
      isAuthenticated: Boolean(state.user),
      isAdmin: state.user?.role === 'admin',
      isManager: state.user?.role === 'manager',
      isTechnician: state.user?.role === 'technician',
      setOrgFilter,
      async login(credentials) {
        const result = await api.login(credentials)
        const ids = result.organizations.map((org) => org.id)
        setSelectedOrgIds(ids)
        setState({
          user: result.user,
          organizations: result.organizations,
          selectedOrgIds: ids,
        })
        return result
      },
      async logout() {
        await api.logout()
        setState({ user: null, organizations: [], selectedOrgIds: [] })
      },
      async refreshProfile() {
        const result = await api.getProfile()
        setState((prev) => ({
          ...prev,
          user: result.user,
          organizations: result.organizations,
        }))
        return result
      },
      applyUser(user) {
        setState((prev) => ({ ...prev, user }))
      },
    }
  }, [state])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
