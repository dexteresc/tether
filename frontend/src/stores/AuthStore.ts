import { makeAutoObservable, runInAction } from 'mobx'
import type { Session, User } from '@supabase/supabase-js'

type AuthSubscription = { unsubscribe: () => void }

type SupabaseAuthClient = {
  getSession: () => Promise<{ data: { session: Session | null } }>
  onAuthStateChange: (
    cb: (event: string, session: Session | null) => void,
  ) => { data: { subscription: AuthSubscription } }
  signInWithPassword: (args: { email: string; password: string }) => Promise<{ error: unknown | null }>
  signUp: (args: { email: string; password: string }) => Promise<{ data: { user: User | null }; error: unknown | null }>
  signOut: () => Promise<{ error: unknown | null }>
}

type SupabaseClientLike = {
  auth: SupabaseAuthClient
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: any) => any
}

export class AuthStore {
  user: User | null = null
  session: Session | null = null
  loading = true
  lastError: string | null = null

  private subscription: AuthSubscription | null = null
  private readonly client: SupabaseClientLike

  constructor(client: SupabaseClientLike) {
    this.client = client
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get isAuthenticated(): boolean {
    return !!this.session?.access_token
  }

  get accessToken(): string | null {
    return this.session?.access_token ?? null
  }

  async init(): Promise<void> {
    this.loading = true
    const { data } = await this.client.auth.getSession()

    runInAction(() => {
      this.session = data.session
      this.user = data.session?.user ?? null
      this.loading = false
    })

    const {
      data: { subscription },
    } = this.client.auth.onAuthStateChange((_event, session) => {
      runInAction(() => {
        this.session = session
        this.user = session?.user ?? null
        this.loading = false
      })
    })

    this.subscription = subscription
  }

  dispose(): void {
    this.subscription?.unsubscribe()
    this.subscription = null
  }

  async signUp(email: string, password: string, name: string): Promise<void> {
    this.lastError = null
    const { data, error } = await this.client.auth.signUp({ email, password })
    if (error) {
      runInAction(() => {
        this.lastError = String(error)
      })
      throw error
    }

    if (data.user) {
      const { error: entityError } = await this.client.rpc('create_user_entity', {
        p_email: email,
        p_name: name,
        p_user_id: data.user.id,
      })
      if (entityError) {
        runInAction(() => {
          this.lastError = String(entityError)
        })
        throw entityError
      }
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    this.lastError = null
    const { error } = await this.client.auth.signInWithPassword({ email, password })
    if (error) {
      runInAction(() => {
        this.lastError = String(error)
      })
      throw error
    }
  }

  async signOut(): Promise<void> {
    this.lastError = null
    const { error } = await this.client.auth.signOut()
    if (error) {
      runInAction(() => {
        this.lastError = String(error)
      })
      throw error
    }
  }
}

