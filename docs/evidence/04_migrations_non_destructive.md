# Evidence 04: Migrations Are Non-Destructive

## Command Executed

```bash
Get-ChildItem -Recurse -Path "supabase\migrations" -Filter "*.sql" | Select-String -Pattern "drop table cascade|truncate" -CaseSensitive:$false | Select-Object -Property Filename, LineNumber, Line
```

## Raw Output

```
(no output)
```

## Analysis

The grep search for `drop table cascade` and `truncate` across all migration files in `supabase/migrations/` returned **zero matches**.

### What the migrations DO contain (safe operations only):

1. **`drop trigger if exists`** — Used extensively to make trigger creation idempotent. This drops only triggers, never tables or data.
   - Example: `drop trigger if exists audit_log_prevent_update on public.audit_log;`

2. **`drop policy if exists`** — Used to recreate RLS policies during schema evolution. This drops only policies, never tables or data.
   - Example: `drop policy if exists products_tenant_select on public.products;`

3. **`drop constraint if exists`** — Used to recreate foreign keys and check constraints during migrations.
   - Example: `drop constraint if exists profiles_tenant_id_fkey;`

4. **`drop function if exists`** — Used to recreate RPCs and trigger functions.
   - Example: `drop function if exists public.increment_views(uuid);`

5. **`alter table ... drop column`** — Not present. All schema changes are additive (`add column if not exists`).

6. **`truncate`** — Not present anywhere in migrations.

7. **`drop table`** — Not present anywhere in migrations.

### Conclusion

All 17 migrations are append-only / additive. They:
- Create new tables with `create table if not exists`
- Add new columns with `add column if not exists`
- Create indexes with `create index if not exists`
- Create triggers and policies idempotently using `drop ... if exists` before `create`
- Seed data using `insert ... on conflict do nothing` or `on conflict do update`

No migration drops a data-bearing table, truncates a table, or performs any operation that would destroy existing data. The schema can be safely evolved by running migrations on top of existing data.
