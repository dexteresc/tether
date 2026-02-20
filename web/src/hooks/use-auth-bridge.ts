import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import type { RootStore } from "@/stores/RootStore";

/**
 * Bridges web/'s auth-context session into the MobX AuthStore.
 * This enables the sync engine's MobX reaction to start/stop
 * based on authentication state.
 */
export function useAuthBridge(store: RootStore): void {
  const { session } = useAuth();

  useEffect(() => {
    store.auth.setSession(session);
  }, [session, store.auth]);

  useEffect(() => {
    store.startAuthReaction();
    return () => store.dispose();
  }, [store]);
}
