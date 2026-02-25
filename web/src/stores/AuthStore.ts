import { makeAutoObservable } from "mobx";
import type { Session } from "@supabase/supabase-js";

/**
 * Simplified AuthStore that receives session from web/'s auth-context
 * via the useAuthBridge hook, rather than managing auth directly.
 */
export class AuthStore {
  // Session uses null because Supabase's API returns Session | null
  session: Session | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get isAuthenticated(): boolean {
    return !!this.session?.access_token;
  }

  get accessToken(): string | undefined {
    return this.session?.access_token;
  }

  setSession(session: Session | null): void {
    this.session = session;
  }
}
