import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AuthPage } from './pages/AuthPage'
import { RequireAuth } from './routes/RequireAuth'
import { EntitiesPage } from './pages/EntitiesPage'
import { EntityDetailPage } from './pages/EntityDetailPage'
import { IntelPage } from './pages/IntelPage'
import { RelationsPage } from './pages/RelationsPage'
import { IdentifiersPage } from './pages/IdentifiersPage'
import { SourcesPage } from './pages/SourcesPage'
import { IntelEntitiesPage } from './pages/IntelEntitiesPage'
import { GraphPage } from './pages/GraphPage'
import { NLInputPage } from './pages/NLInputPage'

function HomePage() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Tether</h1>
      <p>Local-first intelligence app (WIP).</p>
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link to="/nl-input">Natural Language Input</Link>
        <Link to="/entities">View Entities</Link>
        <Link to="/intel">View Intel</Link>
        <Link to="/relations">View Relations</Link>
        <Link to="/identifiers">View Identifiers</Link>
        <Link to="/sources">View Sources</Link>
        <Link to="/intel-entities">View Intel-Entity Relationships</Link>
        <Link to="/graph">View Relationship Graph</Link>
      </div>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Not found</h1>
      <Link to="/">Go home</Link>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/nl-input" element={<NLInputPage />} />
            <Route path="/entities" element={<EntitiesPage />} />
            <Route path="/entities/:id" element={<EntityDetailPage />} />
            <Route path="/intel" element={<IntelPage />} />
            <Route path="/relations" element={<RelationsPage />} />
            <Route path="/identifiers" element={<IdentifiersPage />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="/intel-entities" element={<IntelEntitiesPage />} />
            <Route path="/graph" element={<GraphPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
