import { useAuth } from "@/hooks/use-auth";
import { Outlet, Navigate } from "react-router";

function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return session ? <Outlet /> : <Navigate to="/login" replace />;
}

export default ProtectedRoute;
