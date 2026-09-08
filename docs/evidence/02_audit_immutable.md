# Evidence 02: Audit Table Immutability (UPDATE/DELETE Blocked)

## Migration Reference

File: `supabase/migrations/0013_immutability_triggers.sql`

```sql
-- 0013_immutability_triggers.sql
-- Phase: Database-level immutability for append-only audit tables.
-- Prevents UPDATE and DELETE operations on audit_log and ask_logs by standard roles.

-- ============================================================================
-- 1. Immutability trigger function
-- ============================================================================

create or replace function public.prevent_immutable_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'table % is immutable; UPDATE and DELETE are not allowed', tg_relname;
end;
$$;

-- ============================================================================
-- 2. Apply to audit_log
-- ============================================================================

drop trigger if exists audit_log_prevent_update on public.audit_log;
create trigger audit_log_prevent_update
  before update or delete on public.audit_log
  for each row execute function public.prevent_immutable_update();

-- ============================================================================
-- 3. Apply to ask_logs
-- ============================================================================

drop trigger if exists ask_logs_prevent_update on public.ask_logs;
create trigger ask_logs_prevent_update
  before update or delete on public.ask_logs
  for each row execute function public.prevent_immutable_update();
```

## Trigger Verification

Command:
```bash
npx supabase db query "SELECT trigger_name, event_manipulation, action_statement FROM information_schema.triggers WHERE trigger_schema = 'public' AND event_object_table IN ('audit_log', 'ask_logs') ORDER BY event_object_table, trigger_name;"
```

Output:
```
| trigger_name             | event_manipulation | action_statement                            |
|--------------------------|--------------------|---------------------------------------------|
| ask_logs_prevent_update  | DELETE             | EXECUTE FUNCTION prevent_immutable_update() |
| ask_logs_prevent_update  | UPDATE             | EXECUTE FUNCTION prevent_immutable_update() |
| audit_log_prevent_update | DELETE             | EXECUTE FUNCTION prevent_immutable_update() |
| audit_log_prevent_update | UPDATE             | EXECUTE FUNCTION prevent_immutable_update() |
```

## Actual Test Results

### Setup: Insert test rows

```sql
INSERT INTO public.tenants (id, display_name) VALUES ('11111111-1111-1111-1111-111111111111', 'Test Tenant A');
INSERT INTO public.ask_logs (tenant_id, question, answer) VALUES ('11111111-1111-1111-1111-111111111111', 'test?', 'answer');
INSERT INTO public.audit_log (tenant_id, actor, action, old_value, new_value) VALUES ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'confirm', '{}', '{}');
```

### Test 1: UPDATE audit_log (expected FAIL)

Command:
```bash
npx supabase db query "UPDATE public.audit_log SET action = 'edit' WHERE id = '7acbddf0-f94a-4232-bdd8-7181f938c6a9';"
```

Output:
```
Connecting to local database...
failed to execute query: error: table audit_log is immutable; UPDATE and DELETE are not allowed
Try rerunning the command with --debug to troubleshoot error.
```

**Result: FAILED as expected.**

### Test 2: DELETE audit_log (expected FAIL)

Command:
```bash
npx supabase db query "DELETE FROM public.audit_log WHERE id = '7acbddf0-f94a-4232-bdd8-7181f938c6a9';"
```

Output:
```
Connecting to local database...
failed to execute query: error: table audit_log is immutable; UPDATE and DELETE are not allowed
Try rerunning the command with --debug to troubleshoot error.
```

**Result: FAILED as expected.**

### Test 3: UPDATE ask_logs (expected FAIL)

Command:
```bash
npx supabase db query "UPDATE public.ask_logs SET answer = 'hacked' WHERE id = '61dfe932-9e65-4586-97ac-2ab69b1a3913';"
```

Output:
```
Connecting to local database...
failed to execute query: error: table ask_logs is immutable; UPDATE and DELETE are not allowed
Try rerunning the command with --debug to troubleshoot error.
```

**Result: FAILED as expected.**

### Test 4: DELETE ask_logs (expected FAIL)

Command:
```bash
npx supabase db query "DELETE FROM public.ask_logs WHERE id = '61dfe932-9e65-4586-97ac-2ab69b1a3913';"
```

Output:
```
Connecting to local database...
failed to execute query: error: table ask_logs is immutable; UPDATE and DELETE are not allowed
Try rerunning the command with --debug to troubleshoot error.
```

**Result: FAILED as expected.**

## Impact

- `audit_log` rows are append-only. Any attempt to modify or delete them raises a PostgreSQL exception.
- `ask_logs` rows are append-only. Any attempt to modify or delete them raises a PostgreSQL exception.
- This applies to all roles, including `postgres` superuser, because PostgreSQL BEFORE triggers fire for all roles unless explicitly disabled per-session.
- The immutability guarantee is enforced at the database engine level, not application level, making it tamper-resistant.

## Cleanup

Test data was cleaned up by disabling triggers temporarily, deleting test rows, and re-enabling triggers. The current database state shows `0` rows in both `audit_log` and `ask_logs`.
