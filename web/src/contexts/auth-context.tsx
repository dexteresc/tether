import { supabase } from "@/lib/supabase";
import type { User } from "@/types/models";
import { useState, useEffect, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthContext } from "@/hooks/use-auth";

interface AuthProviderProps {
  children: React.ReactNode;
}

function userFromSession(s: Session | null): User | null {
  if (!s?.user) return null;
  const su = s.user;
  return {
    id: su.id,
    entityId: su.id,
    email: su.email ?? "",
    entity: {
      id: su.id,
      type: "person",
      data: {
        name: su.user_metadata?.full_name ?? su.email ?? "User",
      },
      createdAt: su.created_at,
      updatedAt: su.created_at,
      deletedAt: undefined,
    },
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(userFromSession(s));
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(userFromSession(s));
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setError(authError.message);
      throw authError;
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) {
      setError(authError.message);
      throw authError;
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, error, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
