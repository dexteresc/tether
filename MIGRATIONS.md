# Database Migrations - GORM + Supabase

## Architecture Decision

**Approach: Separate Systems**
- **Supabase migrations** handle ALL schema changes
- **GORM** is used only as an ORM (no AutoMigrate)
- Schema is the single source of truth in `supabase/migrations/`

## Why This Approach?

GORM's AutoMigrate and Supabase have conflicts:
- Different constraint naming conventions
- RLS policies prevent certain ALTER operations
- Type handling differences

## Workflow

### When Models Change

1. **Update the Go model** in `models/`
   ```go
   // Example: Add new field to Entity
   type Entity struct {
       BaseModel
       Type string `json:"type"`
       NewField string `json:"new_field"` // New!
   }
   ```

2. **Create a Supabase migration**
   ```bash
   supabase migration new add_entity_new_field
   ```

3. **Write the SQL migration**
   ```sql
   -- supabase/migrations/TIMESTAMP_add_entity_new_field.sql
   ALTER TABLE entities ADD COLUMN new_field TEXT;
   ```

4. **Apply the migration**
   ```bash
   supabase db reset  # Local
   # Or for production:
   supabase db push
   ```

### Model Types

Use proper types that match PostgreSQL:

```go
type BaseModel struct {
    ID        string         `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
    CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
    UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
    DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
}
```

**Type Mappings:**
- `time.Time` → `TIMESTAMPTZ`
- `gorm.DeletedAt` → `TIMESTAMPTZ` (with soft delete support)
- `string` → `TEXT` or `VARCHAR`
- `datatypes.JSON` → `JSONB`

## Development Setup

```bash
# 1. Start Supabase
supabase start

# 2. Migrations are auto-applied

# 3. Start Go backend
go run main.go  # Uses existing schema
```

## Benefits

✓ Single source of truth (SQL migrations)
✓ Works with Supabase RLS policies
✓ Clean separation of concerns
✓ GORM still handles all ORM operations
✓ Version controlled schema changes

## When You Need to...

**Add a table:** Create Supabase migration + Go model
**Add a column:** Update model + Create migration
**Change a column:** Update model + Create migration
**Add an index:** Create migration (optional: add to model)
**Add RLS policy:** Create migration only

## Notes

- GORM tags still work for queries, relationships, and validation
- `gorm:"type:uuid"` helps GORM understand the schema
- Soft deletes work via `gorm.DeletedAt`
- AutoCreateTime/AutoUpdateTime work with existing columns
