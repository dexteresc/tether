import { useAuth } from "@/contexts/auth-context";
import { Outlet, Navigate } from "react-router";

function ProtectedRoute() {
  const { user, loading } = useAuth();
  console.log("🔍 ProtectedRoute - user:", user, "loading:", loading);

  if (loading) {
    return <div>Loading...</div>; // Replace with proper loading component
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export default ProtectedRoute;
