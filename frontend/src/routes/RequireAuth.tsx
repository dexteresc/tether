import { observer } from 'mobx-react-lite'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useRootStore } from '../stores/RootStore'

export const RequireAuth = observer(function RequireAuth() {
  const { auth } = useRootStore()
  const location = useLocation()

  if (auth.loading) return <div style={{ padding: 24 }}>Loading…</div>

  if (!auth.isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location }} />
  }

  return <Outlet />
})

