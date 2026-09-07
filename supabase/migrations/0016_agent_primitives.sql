-- 0016_agent_primitives.sql
-- Agent primitives layer (v4 architecture foundation):
--   action_ledger — every AI/agent action is auditable
--   autonomy_settings — per-business per-action autonomy dial
--   kill_switch — global + per-type emergency stop
-- Append-only: adds new tables, functions, RLS. Does not modify existing data.

-- ============================================================================
-- 1. action_ledger
-- ============================================================================

create table if not exists public.action_ledger (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.tenants(id) on delete cascade,
  actor_type          text not null check (actor_type in ('system', 'merchant', 'expert')),
  tool_name           text not null,
  input_summary       text not null,
  result_summary      text not null,
  status              text not null check (status in ('success', 'failed', 'rolled_back')),
  autonomy_level      int not null default 0 check (autonomy_level >= 0 and autonomy_level <= 5),
  estimated_value_pkr numeric not null default 0,
  reversible          boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists action_ledger_business_created_idx
  on public.action_ledger (business_id, created_at desc);

-- ============================================================================
-- 2. autonomy_settings
-- ============================================================================

create table if not exists public.autonomy_settings (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.tenants(id) on delete cascade,
  action_type  text not null check (action_type in (
    'rescan', 'digest', 'reply_draft', 'udhaar_reminder', 'invoice'
  )),
  level        int not null default 0 check (level >= 0 and level <= 5),
  auto_approve boolean not null default false,
  updated_at   timestamptz not null default now(),
  constraint autonomy_settings_business_action_unique
    unique (business_id, action_type)
);

-- ============================================================================
-- 3. kill_switch
-- ============================================================================

create table if not exists public.kill_switch (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants(id) on delete cascade,
  scope       text not null check (scope in ('global', 'action_type')),
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists kill_switch_business_idx
  on public.kill_switch (business_id);

-- ============================================================================
-- 4. Helper function: get_autonomy_level
-- Returns 0 if global kill-switch is active for this business,
-- otherwise returns the configured autonomy level for the action_type.
-- ============================================================================

create or replace function public.get_autonomy_level(
  p_business_id  uuid,
  p_action_type  text
)
returns int
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select level
     from public.autonomy_settings
     where business_id = p_business_id
       and action_type = p_action_type
     limit 1),
    0
  );
$$;

-- Global kill-switch override: if any global kill_switch row is active, level is 0.
create or replace function public.is_kill_switch_active(p_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.kill_switch
    where business_id = p_business_id
      and scope = 'global'
      and active = true
  );
$$;

-- Final helper: returns 0 if global kill-switch active, else autonomy_settings level.
create or replace function public.get_autonomy_level_with_kill_switch(
  p_business_id  uuid,
  p_action_type  text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_kill_switch_active(p_business_id) then
    return 0;
  end if;

  return coalesce(
    (select level
     from public.autonomy_settings
     where business_id = p_business_id
       and action_type = p_action_type
     limit 1),
    0
  );
end;
$$;

grant execute on function public.get_autonomy_level(uuid, text) to authenticated;
grant execute on function public.is_kill_switch_active(uuid) to authenticated;
grant execute on function public.get_autonomy_level_with_kill_switch(uuid, text) to authenticated;

-- ============================================================================
-- 5. RLS policies
-- ============================================================================

-- action_ledger: owner-scoped (business_id = auth.uid())
alter table public.action_ledger enable row level security;

create policy "action_ledger_owner_select" on public.action_ledger
  for select using (business_id = auth.uid());
create policy "action_ledger_owner_insert" on public.action_ledger
  for insert with check (business_id = auth.uid());
create policy "action_ledger_owner_delete" on public.action_ledger
  for delete using (business_id = auth.uid());
grant select, insert, delete on public.action_ledger to authenticated;

-- autonomy_settings: owner-scoped
alter table public.autonomy_settings enable row level security;

create policy "autonomy_settings_owner_select" on public.autonomy_settings
  for select using (business_id = auth.uid());
create policy "autonomy_settings_owner_insert" on public.autonomy_settings
  for insert with check (business_id = auth.uid());
create policy "autonomy_settings_owner_update" on public.autonomy_settings
  for update using (business_id = auth.uid());
create policy "autonomy_settings_owner_delete" on public.autonomy_settings
  for delete using (business_id = auth.uid());
grant select, insert, update, delete on public.autonomy_settings to authenticated;

-- kill_switch: owner-scoped
alter table public.kill_switch enable row level security;

create policy "kill_switch_owner_select" on public.kill_switch
  for select using (business_id = auth.uid());
create policy "kill_switch_owner_insert" on public.kill_switch
  for insert with check (business_id = auth.uid());
create policy "kill_switch_owner_update" on public.kill_switch
  for update using (business_id = auth.uid());
create policy "kill_switch_owner_delete" on public.kill_switch
  for delete using (business_id = auth.uid());
grant select, insert, update, delete on public.kill_switch to authenticated;
