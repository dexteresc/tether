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
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
        <nav className="flex gap-3 items-center text-sm">
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

        <div className="flex gap-3 items-center">
          <SyncIndicator />
          <button onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200 p-3 text-gray-500">
        <div className="flex justify-between">
          <span>Connection: {syncStatus.connectionStatus}</span>
          {syncStatus.lastSyncAt ? <span>Last sync: {new Date(syncStatus.lastSyncAt).toLocaleString()}</span> : null}
        </div>
      </footer>
    </div>
  )
})

const SyncIndicator = observer(function SyncIndicator() {
  const { syncStatus } = useRootStore()

  const getStatusColorClass = () => {
    if (syncStatus.lastError) return 'bg-red-700'
    if (syncStatus.connectionStatus === 'offline') return 'bg-amber-500'
    if (syncStatus.progress.phase !== 'idle') return 'bg-blue-600'
    return 'bg-emerald-600'
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
    <div className="text-xs text-gray-700 flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${getStatusColorClass()}`}
        />
        <span>{getStatusText()}</span>
      </div>
      {syncStatus.pendingOutboxCount > 0 && (
        <span className="text-gray-500">• Pending: {syncStatus.pendingOutboxCount}</span>
      )}
      {syncStatus.lastError && (
        <span className="text-red-700 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
          Error: {syncStatus.lastError}
        </span>
      )}
    </div>
  )
})

