import { useAuth } from "@/contexts/auth-context";
import { Outlet, Navigate } from "react-router";

function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return session ? <Outlet /> : <Navigate to="/login" replace />;
}

export default ProtectedRoute;
