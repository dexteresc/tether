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
    <div className="p-6">
      <h1 className="text-3xl font-bold">Tether</h1>
      <p>Local-first intelligence app (WIP).</p>
      <div className="mt-6 flex flex-col gap-2">
        <Link to="/nl-input" className="text-blue-500 hover:underline">Natural Language Input</Link>
        <Link to="/entities" className="text-blue-500 hover:underline">View Entities</Link>
        <Link to="/intel" className="text-blue-500 hover:underline">View Intel</Link>
        <Link to="/relations" className="text-blue-500 hover:underline">View Relations</Link>
        <Link to="/identifiers" className="text-blue-500 hover:underline">View Identifiers</Link>
        <Link to="/sources" className="text-blue-500 hover:underline">View Sources</Link>
        <Link to="/intel-entities" className="text-blue-500 hover:underline">View Intel-Entity Relationships</Link>
        <Link to="/graph" className="text-blue-500 hover:underline">View Relationship Graph</Link>
      </div>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">Not found</h1>
      <Link to="/" className="text-blue-500 hover:underline">Go home</Link>
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
