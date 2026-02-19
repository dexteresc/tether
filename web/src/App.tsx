import { Route, Routes } from "react-router";
import { AuthProvider } from "./contexts/auth-context";
import ProtectedRoute from "./components/protected-route";
import LoginPage from "./pages/login-page";
import Dashboard from "./pages/dashboard-page";
import RegisterPage from "./pages/register-page";
import MainLayout from "./main-layout";
import LogoutPage from "./pages/logout-page";
import NotFound from "./pages/not-found";

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<ProtectedRoute />}>
          <Route path="logout" element={<LogoutPage />} />
          <Route element={<MainLayout />}>
            <Route index element={<Dashboard />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
