-- 0019_rescan_brain.sql
-- Level 1 autonomy: re-scan delta detection system
-- Adds possibly_removed status to business_facts, rescan_schedules table,
-- and helper RPCs for delta-aware re-scanning.

-- ============================================================================
-- 1. Update business_facts status constraint to include 'possibly_removed'
-- ============================================================================

alter table public.business_facts
  drop constraint if exists business_facts_status_check;

alter table public.business_facts
  add constraint business_facts_status_check
  check (status in ('needs_review','confirmed','rejected','possibly_removed'));

-- ============================================================================
-- 2. rescan_schedules table
-- ============================================================================

create table if not exists public.rescan_schedules (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.tenants(id) on delete cascade,
  cadence       text not null check (cadence in ('monthly','weekly','daily','daily_instant','manual')),
  last_run_at   timestamptz,
  next_run_at   timestamptz,
  last_delta_count int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint rescan_schedules_business_unique unique (business_id)
);

create index if not exists rescan_schedules_business_idx
  on public.rescan_schedules (business_id);

create index if not exists rescan_schedules_next_run_idx
  on public.rescan_schedules (next_run_at)
  where next_run_at is not null;

alter table public.rescan_schedules enable row level security;

drop policy if exists rescan_schedules_owner_select on public.rescan_schedules;
create policy rescan_schedules_owner_select on public.rescan_schedules
  for select using (business_id = auth.uid());

drop policy if exists rescan_schedules_owner_insert on public.rescan_schedules;
create policy rescan_schedules_owner_insert on public.rescan_schedules
  for insert with check (business_id = auth.uid());

drop policy if exists rescan_schedules_owner_update on public.rescan_schedules;
create policy rescan_schedules_owner_update on public.rescan_schedules
  for update using (business_id = auth.uid());

drop policy if exists rescan_schedules_owner_delete on public.rescan_schedules;
create policy rescan_schedules_owner_delete on public.rescan_schedules
  for delete using (business_id = auth.uid());

grant select, insert, update, delete on public.rescan_schedules to authenticated;

-- ============================================================================
-- 3. Helper: upsert_rescan_schedule
-- ============================================================================

create or replace function public.upsert_rescan_schedule(
  p_business_id uuid,
  p_cadence text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.rescan_schedules (business_id, cadence, next_run_at)
  values (
    p_business_id,
    p_cadence,
    case p_cadence
      when 'monthly' then now() + interval '30 days'
      when 'weekly' then now() + interval '7 days'
      when 'daily' then now() + interval '1 day'
      when 'daily_instant' then now() + interval '1 day'
      else now() + interval '30 days'
    end
  )
  on conflict (business_id) do update
    set cadence = excluded.cadence,
        next_run_at = excluded.next_run_at,
        updated_at = now();
end;
$$;

grant execute on function public.upsert_rescan_schedule(uuid, text) to authenticated;

-- ============================================================================
-- 4. Helper: get_rescan_schedule_for_business
-- ============================================================================

create or replace function public.get_rescan_schedule_for_business(
  p_business_id uuid
)
returns setof public.rescan_schedules
language sql
security definer
set search_path = public
as $$
  select * from public.rescan_schedules
  where business_id = p_business_id;
$$;

grant execute on function public.get_rescan_schedule_for_business(uuid) to authenticated;

-- ============================================================================
-- 5. Helper: list_due_rescans
-- Returns businesses that are due for a re-scan (for pg_cron or external cron)
-- ============================================================================

create or replace function public.list_due_rescans(p_limit int default 50)
returns table (
  business_id uuid,
  cadence text,
  last_run_at timestamptz,
  next_run_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select rs.business_id, rs.cadence, rs.last_run_at, rs.next_run_at
  from public.rescan_schedules rs
  where rs.next_run_at is not null
    and rs.next_run_at <= now()
  limit p_limit;
$$;

grant execute on function public.list_due_rescans(int) to service_role;

-- ============================================================================
-- 6. Helper: mark_rescan_complete
-- Updates schedule after a successful re-scan
-- ============================================================================

create or replace function public.mark_rescan_complete(
  p_business_id uuid,
  p_delta_count int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cadence text;
  v_interval interval;
begin
  select rs.cadence into v_cadence
  from public.rescan_schedules rs
  where rs.business_id = p_business_id;

  if not found then
    v_cadence := 'monthly';
  end if;

  case v_cadence
    when 'monthly' then v_interval := interval '30 days';
    when 'weekly' then v_interval := interval '7 days';
    when 'daily' then v_interval := interval '1 day';
    when 'daily_instant' then v_interval := interval '1 day';
    else v_interval := interval '30 days';
  end case;

  update public.rescan_schedules
  set last_run_at = now(),
      next_run_at = now() + v_interval,
      last_delta_count = p_delta_count,
      updated_at = now()
  where business_id = p_business_id;
end;
$$;

grant execute on function public.mark_rescan_complete(uuid, int) to authenticated;
