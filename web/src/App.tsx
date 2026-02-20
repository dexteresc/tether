import { useMemo } from "react";
import { Route, Routes } from "react-router";
import { AuthProvider } from "./contexts/auth-context";
import ProtectedRoute from "./components/protected-route";
import LoginPage from "./pages/login-page";
import Dashboard from "./pages/dashboard-page";
import RegisterPage from "./pages/register-page";
import MainLayout from "./main-layout";
import LogoutPage from "./pages/logout-page";
import NotFound from "./pages/not-found";
import { RootStore, RootStoreProvider } from "./stores/RootStore";
import { useAuthBridge } from "./hooks/use-auth-bridge";

// Pages
import { NLInputPage } from "./pages/nl-input-page";
import { EntitiesPage } from "./pages/entities-page";
import { EntityDetailPage } from "./pages/entity-detail-page";
import { IntelPage } from "./pages/intel-page";
import { RelationsPage } from "./pages/relations-page";
import { IdentifiersPage } from "./pages/identifiers-page";
import { SourcesPage } from "./pages/sources-page";
import { IntelEntitiesPage } from "./pages/intel-entities-page";
import { GraphPage } from "./pages/graph-page";

function AppWithStore() {
  const store = useMemo(() => new RootStore(), []);
  useAuthBridge(store);

  return (
    <RootStoreProvider store={store}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<ProtectedRoute />}>
          <Route path="logout" element={<LogoutPage />} />
          <Route element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="nl-input" element={<NLInputPage />} />
            <Route path="entities" element={<EntitiesPage />} />
            <Route path="entities/:id" element={<EntityDetailPage />} />
            <Route path="intel" element={<IntelPage />} />
            <Route path="relations" element={<RelationsPage />} />
            <Route path="identifiers" element={<IdentifiersPage />} />
            <Route path="sources" element={<SourcesPage />} />
            <Route path="intel-entities" element={<IntelEntitiesPage />} />
            <Route path="graph" element={<GraphPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </RootStoreProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppWithStore />
    </AuthProvider>
  );
}

export default App;
