# Migrate from Custom Auth to Supabase Auth

## Phase 1: Local Supabase Setup

1. **Initialize Supabase locally**
   - Run `supabase init` in project root (creates `supabase/` dir with `config.toml`)
   - Run `supabase start` to spin up local stack (Auth, Postgres, Studio)
   - Note the local credentials (anon key, JWT secret, etc.)

2. **Update docker-compose.yml**
   - Remove `postgres` service (Supabase provides Postgres on port 54322)
   - Keep `ollama` service
   - Remove `postgres_data` volume

3. **Update `.env`**
   - Set `SUPABASE_URL=http://127.0.0.1:54321`
   - Set real `SUPABASE_ANON_KEY` and `SUPABASE_JWT_SECRET` from `supabase status`
   - DB vars already point to 127.0.0.1:54322 (correct for Supabase local)

## Phase 2: Backend — Replace JWT Auth

4. **New file: `middleware/auth.go`** — Supabase JWT middleware
   - Extract Bearer token from Authorization header
   - Parse/validate JWT using `SUPABASE_JWT_SECRET` (HS256) via `golang-jwt/jwt/v4` (already in go.mod)
   - Extract `sub` (Supabase user UUID) and `email` from claims
   - Lazy sync: look up User by `supabase_id`, if not found create User + Entity + Identifiers in a transaction
   - Store user in Gin context (`c.Set("user", user)`)

5. **Update `models/user.go`**
   - Replace `PasswordHash string` with `SupabaseID string` (unique index, not null)
   - Remove `Login` struct
   - Remove `HashPassword()` and `CheckPassword()` methods
   - Remove `golang.org/x/crypto/bcrypt` import

6. **Update `services/user.go`**
   - Remove `AuthenticateUser()` function
   - Replace `GetUserByEmail()` with `GetUserBySupabaseID(supabaseID string)`
   - Add `CreateUserFromSupabase(supabaseID, email string)` — creates User + Entity + email Identifier in a transaction

7. **Update `handlers/user.go`**
   - Remove `CreateUser` handler (signup handled by Supabase)
   - Update `GetCurrentUser` — get user from Gin context (set by middleware) instead of parsing JWT claims
   - Update `UpdateUser` — remove password update logic
   - Keep `GetUser`, `DeleteUser` as-is (just remove password references)

8. **Update `main.go`**
   - Remove entire `appleboy/gin-jwt/v2` setup (lines 34-104)
   - Remove auth-related imports
   - Replace with: `authMiddleware := middleware.SupabaseAuth()`
   - Remove public auth routes (`/api/auth/login`, `/api/auth/register`, `/api/auth/refresh_token`)
   - Keep `GET /api/auth/me` under protected routes
   - Add `SUPABASE_JWT_SECRET` env var read

9. **Clean up Go dependencies**
   - `go mod tidy` will remove `appleboy/gin-jwt/v2` and `golang.org/x/crypto/bcrypt`

## Phase 3: Frontend — Supabase JS Client

10. **Install `@supabase/supabase-js`** in `web/`

11. **New file: `web/src/lib/supabase.ts`** — Supabase client
    - `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`
    - Export the client instance

12. **Update `web/src/lib/config.ts`**
    - Add `SUPABASE_URL` from `VITE_SUPABASE_URL` (default `http://127.0.0.1:54321`)
    - Add `SUPABASE_ANON_KEY` from `VITE_SUPABASE_ANON_KEY`

13. **Update `web/src/api/client.ts`**
    - Replace `localStorage.getItem("authToken")` with getting token from Supabase session
    - Import supabase client, call `supabase.auth.getSession()` for token

14. **Rewrite `web/src/contexts/auth-context.tsx`**
    - Use `supabase.auth.onAuthStateChange()` to track session
    - `login()` → `supabase.auth.signInWithPassword()`
    - `logout()` → `supabase.auth.signOut()`
    - Add `register()` → `supabase.auth.signUp()`
    - On auth state change, call `/api/auth/me` to get the app User (with Entity data)
    - Remove `refreshToken()` — Supabase handles this automatically

15. **Delete `web/src/lib/auth.ts`** — no longer needed

16. **Update `web/src/types/api.ts`**
    - Remove `LoginCredentials` and `AuthResponse` (Supabase SDK has its own types)
    - Keep `ApiError`

17. **Rewrite `web/src/pages/register-page.tsx`**
    - Call `register()` from auth context (which calls `supabase.auth.signUp()`)
    - Add name field (passed as user metadata to Supabase, used by lazy sync)
    - Show errors, handle email confirmation if enabled

18. **Clean up `web/src/pages/login-page.tsx`**
    - Remove all `console.log` debug statements
    - Use updated `login()` from auth context

19. **Update `.env` / Vite env vars**
    - Add `VITE_SUPABASE_URL=http://127.0.0.1:54321`
    - Add `VITE_SUPABASE_ANON_KEY=<from supabase status>`

## Phase 4: Test Locally

20. **Start the stack**
    - `supabase start`
    - `docker compose up ollama` (if needed)
    - Go backend: `go run .` (or `air`)
    - Frontend: `cd web && npm run dev`

21. **Test the flow**
    - Register a new account via the register page
    - Verify Supabase Studio shows the user in Auth > Users
    - Verify the backend created User + Entity + Identifiers (lazy sync)
    - Log out, log back in
    - Verify `/api/auth/me` returns the full user with entity data
    - Verify protected API routes work with the Supabase JWT
