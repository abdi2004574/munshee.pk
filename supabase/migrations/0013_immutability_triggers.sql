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