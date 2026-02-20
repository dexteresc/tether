import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RootStore, RootStoreProvider } from './stores/RootStore'

function AppWithStore() {
  const [store] = useState(() => new RootStore())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    store.init().then(() => setReady(true))
    return () => store.dispose()
  }, [store])

  if (!ready) {
    return <div className="p-6">Initializing...</div>
  }

  return (
    <RootStoreProvider store={store}>
      <App />
    </RootStoreProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithStore />
  </StrictMode>,
)
