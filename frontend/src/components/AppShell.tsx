import { observer } from 'mobx-react-lite'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useRootStore } from '../stores/RootStore'

export const AppShell = observer(function AppShell() {
  const { auth, syncStatus } = useRootStore()
  const navigate = useNavigate()

  async function onSignOut() {
    await auth.signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header
        style={{
          borderBottom: '1px solid #e5e7eb',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <nav style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 14 }}>
          <Link to="/">Home</Link>
          <Link to="/nl-input">NL Input</Link>
          <Link to="/entities">Entities</Link>
          <Link to="/intel">Intel</Link>
          <Link to="/relations">Relations</Link>
          <Link to="/identifiers">Identifiers</Link>
          <Link to="/sources">Sources</Link>
          <Link to="/intel-entities">Intel-Entities</Link>
          <Link to="/graph">Graph</Link>
        </nav>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <SyncIndicator />
          <button onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      <footer style={{ borderTop: '1px solid #e5e7eb', padding: 12, color: '#6b7280' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Connection: {syncStatus.connectionStatus}</span>
          {syncStatus.lastSyncAt ? <span>Last sync: {new Date(syncStatus.lastSyncAt).toLocaleString()}</span> : null}
        </div>
      </footer>
    </div>
  )
})

const SyncIndicator = observer(function SyncIndicator() {
  const { syncStatus } = useRootStore()

  const getStatusColor = () => {
    if (syncStatus.lastError) return '#b91c1c'
    if (syncStatus.connectionStatus === 'offline') return '#f59e0b'
    if (syncStatus.progress.phase !== 'idle') return '#2563eb'
    return '#059669'
  }

  const getStatusText = () => {
    if (syncStatus.connectionStatus === 'offline') return 'Offline'
    if (syncStatus.progress.phase === 'idle') return 'Synced'

    const phase = syncStatus.progress.phase
    if (phase === 'pull') return 'Pulling changes...'
    if (phase === 'push') return 'Pushing changes...'
    return `Syncing (${phase})`
  }

  return (
    <div style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
          }}
        />
        <span>{getStatusText()}</span>
      </div>
      {syncStatus.pendingOutboxCount > 0 && (
        <span style={{ color: '#6b7280' }}>• Pending: {syncStatus.pendingOutboxCount}</span>
      )}
      {syncStatus.lastError && (
        <span style={{ color: '#b91c1c', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Error: {syncStatus.lastError}
        </span>
      )}
    </div>
  )
})

