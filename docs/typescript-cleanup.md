# TypeScript Cleanup

## Goal

Enforce strict TypeScript discipline across the entire frontend codebase. Zero tolerance for escape hatches that bypass the type system.

## Rules

- **No `as` casts** — use type guards, generics, or proper narrowing. Only exception: `as const`.
- **No `any`** — use `unknown`, generics, or proper types.
- **No `eslint-disable`** — fix the underlying issue, never suppress it.
- **Prefer `undefined` over `null`** — exceptions for Supabase schema fields, `createContext`, and Supabase `.is()` filters.

## What changed

### Hook/component separation
React-refresh requires files to export ONLY components or ONLY hooks — never both. Split into separate files:
- `useSidebar` → `hooks/use-sidebar.ts`
- `useRootStore` → `hooks/use-root-store.ts` (RootStore split into 3 files: class, context, provider)
- `useAuth` → `hooks/use-auth.ts`

### IDB typed operations
Replaced `db.get(table as T & string, id) as any` with direct calls using `idb` library generics (`StoreNames`, `StoreValue`, `StoreKey`, `IndexNames`). TypeScript resolves `TableName` as a valid subset of `StoreNames<TetherDbSchema>` without casts.

### Supabase dynamic table access
`supabase.from(tx.table)` with generic `T extends TableName` can't resolve Supabase's deeply nested conditional types. Solution: `dynamicFrom()` helper that fixes the table type to a concrete value, since only generic operations (select, eq, insert, update) are used.

### Force graph components
`react-force-graph-2d` has no TypeScript types. Typed `ForceGraph2D` as `React.ComponentType<Record<string, unknown>>` and created `GraphNode` interfaces with `x?/y?` for canvas callbacks.

### Dead code removal
Deleted `use-api.ts` and `use-api-query.ts` — unused hooks with file-level eslint-disable.

## Result

- 0 `eslint-disable` comments in the codebase
- 0 `any` types
- `tsc` and `eslint` pass with 0 errors, 0 warnings
