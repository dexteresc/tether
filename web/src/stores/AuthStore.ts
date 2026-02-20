import { makeAutoObservable } from "mobx";
import type { Session } from "@supabase/supabase-js";

/**
 * Simplified AuthStore that receives session from web/'s auth-context
 * via the useAuthBridge hook, rather than managing auth directly.
 */
export class AuthStore {
  session: Session | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get isAuthenticated(): boolean {
    return !!this.session?.access_token;
  }

  get accessToken(): string | null {
    return this.session?.access_token ?? null;
  }

  setSession(session: Session | null): void {
    this.session = session;
  }
}
