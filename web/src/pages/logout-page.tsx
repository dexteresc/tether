import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export default function LogoutPage() {
  const { logout } = useAuth();

  useEffect(() => {
    logout();
  }, [logout]);

  return <p>Logging out...</p>;
}
