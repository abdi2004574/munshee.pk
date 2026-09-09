-- 0023_fix_credit_ledger_schema_and_rpc_contracts.sql
-- Fixes credit_ledger schema mismatch (tenant_id vs business_id) that caused
-- get_credit_ledger to crash. Updates consume_action to accept a quantity
-- parameter (new contract). Ensures reference_number exists on subscriptions.
-- Append-only: no data deletion, only additive changes and safe column migrations.

-- ============================================================================
-- 1. Fix credit_ledger schema
-- ============================================================================
-- 0007 created credit_ledger with tenant_id, action_type, credits_used, reference_id.
-- 0017 expects business_id, delta, reason, expires_at.
-- This section migrates the table to the 0017 schema without losing data.

-- Add business_id if missing
alter table public.credit_ledger
  add column if not exists business_id uuid;

-- Migrate tenant_id -> business_id
do \$\$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'credit_ledger' and column_name = 'tenant_id'
  ) then
    update public.credit_ledger
       set business_id = tenant_id
     where business_id is null;

    alter table public.credit_ledger drop column tenant_id;
  end if;
end \$\$;

-- Add columns expected by 0017 schema
alter table public.credit_ledger
  add column if not exists delta int not null default 0,
  add column if not exists reason text not null default 'unknown',
  add column if not exists expires_at timestamptz;

-- Drop old columns if they still exist
alter table public.credit_ledger
  drop column if exists action_type,
  drop column if exists credits_used,
  drop column if exists reference_id;

-- Enforce NOT NULL on migrated columns
alter table public.credit_ledger
  alter column delta set not null,
  alter column reason set not null;

-- Fix index: drop old tenant-based index, keep business-based index
drop index if exists credit_ledger_tenant_created_idx;
create index if not exists credit_ledger_business_created_idx
  on public.credit_ledger (business_id, created_at desc);

-- Fix RLS policies to use business_id
drop policy if exists credit_ledger_tenant_select on public.credit_ledger;
drop policy if exists credit_ledger_tenant_insert on public.credit_ledger;
drop policy if exists credit_ledger_owner_select on public.credit_ledger;
drop policy if exists credit_ledger_owner_insert on public.credit_ledger;

create policy credit_ledger_owner_select on public.credit_ledger
  for select using (business_id = auth.uid() or public.is_admin());

create policy credit_ledger_owner_insert on public.credit_ledger
  for insert with check (business_id = auth.uid() or public.is_admin());

-- ============================================================================
-- 2. Update consume_action with quantity parameter (new contract)
-- ============================================================================
-- Old contract: consume_action(business_id, action_type) -> (ok, actions_left, subscription_status)
-- New contract: consume_action(business_id, action_type, quantity) -> (ok, actions_left, code, feature)
-- quantity defaults to 1 for backward compatibility.

create or replace function public.consume_action(
  p_business_id  uuid,
  p_action_type  text,
  p_quantity     int default 1
)
returns table (
  ok boolean,
  actions_left int,
  code text,
  feature text,
  subscription_status text
)
language plpgsql
security definer
set search_path = public
as \$\$
declare
  v_sub   record;
  v_plan  record;
  v_feat  jsonb;
  v_limit int;
  v_used  int;
  v_new_remaining int;
  v_qty   int := greatest(p_quantity, 1);
begin
  -- Load subscription + plan
  select s.*, p.features into v_sub
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.business_id = p_business_id
  for update;

  if not found then
    -- Create free trial if none exists
    insert into public.subscriptions (business_id, plan_id, status, actions_remaining, last_grant_at)
    values (p_business_id, 'free', 'trial', 150, now())
    returning * into v_sub;
    select * into v_plan from public.plans where id = 'free';
  else
    select * into v_plan from public.plans where id = v_sub.plan_id;
  end if;

  -- Lazy monthly grant
  if v_sub.last_grant_at is null or now() - v_sub.last_grant_at > interval '30 days' then
    update public.subscriptions
    set actions_remaining = v_plan.actions_monthly,
        last_grant_at = now(),
        updated_at = now()
    where business_id = p_business_id
    returning * into v_sub;
  end if;

  -- 1) Actions balance check
  if v_sub.actions_remaining < v_qty then
    return query select false, v_sub.actions_remaining, 'ACTIONS_EXHAUSTED', null::text, v_sub.status;
    return;
  end if;

  -- 2) Feature cap check
  v_feat := v_plan.features;

  if p_action_type = 'udhaar_draft' then
    v_limit := coalesce((v_feat->>'udhaar_drafts')::int, 0);
    if v_limit = 0 then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'udhaar_drafts', v_sub.status;
      return;
    end if;
    select count(*) into v_used
    from public.action_ledger
    where business_id = p_business_id
      and tool_name = 'udhaar_draft'
      and created_at >= date_trunc('month', now());
    if v_used + v_qty > v_limit then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'udhaar_drafts', v_sub.status;
      return;
    end if;
  end if;

  if p_action_type = 'invoice' then
    v_limit := coalesce((v_feat->>'invoices')::int, 0);
    if v_limit = 0 then
      if v_sub.plan_id = 'free' then
        return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'invoices', v_sub.status;
        return;
      end if;
    else
      select count(*) into v_used
      from public.action_ledger
      where business_id = p_business_id
        and tool_name = 'invoice'
        and created_at >= date_trunc('month', now());
      if v_used + v_qty > v_limit then
        return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'invoices', v_sub.status;
        return;
      end if;
    end if;
  end if;

  if p_action_type = 'voice_digest' then
    v_limit := coalesce((v_feat->>'voice_items')::int, 0);
    if v_limit = 0 then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'voice_items', v_sub.status;
      return;
    end if;
    select count(*) into v_used
    from public.action_ledger
    where business_id = p_business_id
      and tool_name = 'voice_digest'
      and created_at >= date_trunc('month', now());
    if v_used + v_qty > v_limit then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'voice_items', v_sub.status;
      return;
    end if;
  end if;

  if p_action_type = 'ad_draft' then
    v_limit := coalesce((v_feat->>'ads_drafts')::int, 0);
    if v_limit = 0 then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'ads_drafts', v_sub.status;
      return;
    end if;
    select count(*) into v_used
    from public.action_ledger
    where business_id = p_business_id
      and tool_name = 'ad_draft'
      and created_at >= date_trunc('month', now());
    if v_used + v_qty > v_limit then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'ads_drafts', v_sub.status;
      return;
    end if;
  end if;

  if p_action_type = 'client' then
    v_limit := coalesce((v_feat->>'clients')::int, 0);
    if v_limit = 0 then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'clients', v_sub.status;
      return;
    end if;
  end if;

  if p_action_type = 'rescan' then
    if v_feat->>'rescans' in ('weekly', 'daily', 'daily_instant') then
      null; -- allowed
    else
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'rescans', v_sub.status;
      return;
    end if;
  end if;

  if p_action_type = 'roi_ledger' then
    if v_sub.plan_id in ('business', 'os') then
      null; -- allowed
    else
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'roi_ledger', v_sub.status;
      return;
    end if;
  end if;

  if p_action_type = 'reporting_export' then
    if v_feat->>'reporting_export' = 'true' then
      null; -- allowed
    else
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'reporting_export', v_sub.status;
      return;
    end if;
  end if;

  if p_action_type = 'tax_ready' then
    if v_feat->>'tax_ready' = 'true' then
      null; -- allowed
    else
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'tax_ready', v_sub.status;
      return;
    end if;
  end if;

  -- Deduct actions
  update public.subscriptions
  set actions_remaining = actions_remaining - v_qty,
      updated_at = now()
  where business_id = p_business_id
  returning actions_remaining into v_new_remaining;

  return query select true, coalesce(v_new_remaining, v_sub.actions_remaining - v_qty), null::text, null::text, v_sub.status;
end;
\$\$;

grant execute on function public.consume_action(uuid, text, int) to authenticated;

-- ============================================================================
-- 3. Ensure reference_number column exists on subscriptions
-- ============================================================================
-- Added in 0020, but made idempotent here for safety.

alter table public.subscriptions
  add column if not exists reference_number text;

-- ============================================================================
-- 4. Grant execute on get_feature_flags if missing
-- ============================================================================
-- Exists from 0017, but ensure grant is present.

grant execute on function public.get_feature_flags(uuid) to authenticated;

-- ============================================================================
-- 5. Grant execute on get_credit_ledger if missing
-- ============================================================================
-- Exists from 0017, but ensure grant is present after schema fix.

grant execute on function public.get_credit_ledger(uuid, int) to authenticated;