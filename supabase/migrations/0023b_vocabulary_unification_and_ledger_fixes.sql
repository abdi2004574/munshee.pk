-- 0023b_vocabulary_unification_and_ledger_fixes.sql
-- Feature vocabulary unification: consume_action action_type & tool_name must match
-- plans.features JSON keys EXACTLY (source of truth from 0020).
-- Also fixes extract-vision ledger bug (wrong column + wrong tool_name).
-- Append-only: CREATE OR REPLACE functions, no data deletion.

-- ============================================================================
-- 1. Feature vocabulary unification in consume_action
-- ============================================================================
-- plans.features keys (source of truth):
--   rescans, digest, voice_items, udhaar_drafts, invoices,
--   ads_drafts, clients, reporting_export, roi_ledger, tax_ready
-- 
-- OLD consume_action used mismatched strings:
--   udhaar_draft, invoice, voice_digest, ad_draft, client, rescan
-- NEW: all checks now use the EXACT plans.features keys.

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
as $$
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

  -- 2) Feature cap check — KEYS MUST MATCH plans.features EXACTLY
  v_feat := v_plan.features;

  -- udhaar_drafts (was: udhaar_draft)
  if p_action_type = 'udhaar_drafts' then
    v_limit := coalesce((v_feat->>'udhaar_drafts')::int, 0);
    if v_limit = 0 then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'udhaar_drafts', v_sub.status;
      return;
    end if;
    select count(*) into v_used
    from public.action_ledger
    where business_id = p_business_id
      and tool_name = 'udhaar_drafts'
      and created_at >= date_trunc('month', now());
    if v_used + v_qty > v_limit then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'udhaar_drafts', v_sub.status;
      return;
    end if;
  end if;

  -- invoices (was: invoice)
  if p_action_type = 'invoices' then
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
        and tool_name = 'invoices'
        and created_at >= date_trunc('month', now());
      if v_used + v_qty > v_limit then
        return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'invoices', v_sub.status;
        return;
      end if;
    end if;
  end if;

  -- voice_items (was: voice_digest)
  if p_action_type = 'voice_items' then
    v_limit := coalesce((v_feat->>'voice_items')::int, 0);
    if v_limit = 0 then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'voice_items', v_sub.status;
      return;
    end if;
    select count(*) into v_used
    from public.action_ledger
    where business_id = p_business_id
      and tool_name = 'voice_items'
      and created_at >= date_trunc('month', now());
    if v_used + v_qty > v_limit then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'voice_items', v_sub.status;
      return;
    end if;
  end if;

  -- ads_drafts (was: ad_draft)
  if p_action_type = 'ads_drafts' then
    v_limit := coalesce((v_feat->>'ads_drafts')::int, 0);
    if v_limit = 0 then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'ads_drafts', v_sub.status;
      return;
    end if;
    select count(*) into v_used
    from public.action_ledger
    where business_id = p_business_id
      and tool_name = 'ads_drafts'
      and created_at >= date_trunc('month', now());
    if v_used + v_qty > v_limit then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'ads_drafts', v_sub.status;
      return;
    end if;
  end if;

  -- clients (was: client)
  if p_action_type = 'clients' then
    v_limit := coalesce((v_feat->>'clients')::int, 0);
    if v_limit = 0 then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'clients', v_sub.status;
      return;
    end if;
  end if;

  -- rescans (was: rescan)
  if p_action_type = 'rescans' then
    if v_feat->>'rescans' in ('weekly', 'daily', 'daily_instant') then
      null; -- allowed
    else
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'rescans', v_sub.status;
      return;
    end if;
  end if;

  -- roi_ledger (matches)
  if p_action_type = 'roi_ledger' then
    if v_sub.plan_id in ('business', 'os') then
      null; -- allowed
    else
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'roi_ledger', v_sub.status;
      return;
    end if;
  end if;

  -- reporting_export (matches)
  if p_action_type = 'reporting_export' then
    if v_feat->>'reporting_export' = 'true' then
      null; -- allowed
    else
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'reporting_export', v_sub.status;
      return;
    end if;
  end if;

  -- tax_ready (matches)
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
$$;

grant execute on function public.consume_action(uuid, text, int) to authenticated;

-- ============================================================================
-- 2. Fix extract-vision ledger bug (audit 1.2)
-- ============================================================================
-- The extract-vision edge function was inserting into action_ledger with:
--   - `action` column (doesn't exist in action_ledger schema)
--   - `tool_name = 'extract_facts'` (should be 'extract_vision')
-- 
-- action_ledger schema (from 0016): id, business_id, actor_type, tool_name,
--   input_summary, result_summary, status, autonomy_level, estimated_value_pkr,
--   reversible, created_at
-- 
-- This migration adds a helper RPC that the edge function will call to log
-- vision extractions correctly. The edge function code fix is separate.

create or replace function public.log_vision_extraction(
  p_business_id       uuid,
  p_actor_type        text default 'system',
  p_input_summary     text,
  p_result_summary    text,
  p_status            text default 'success',
  p_autonomy_level    int default 0,
  p_estimated_value_pkr numeric default 0,
  p_reversible        boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.action_ledger (
    business_id, actor_type, tool_name, input_summary, result_summary,
    status, autonomy_level, estimated_value_pkr, reversible
  ) values (
    p_business_id, p_actor_type, 'extract_vision', p_input_summary, p_result_summary,
    p_status, p_autonomy_level, p_estimated_value_pkr, p_reversible
  ) returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.log_vision_extraction(uuid, text, text, text, text, int, numeric, boolean) to authenticated, service_role;

-- ============================================================================
-- 3. Add ask_munshee action type to consume_action (if not already covered)
-- ============================================================================
-- The user's V2 test uses 'ask_munshee' which isn't in feature caps.
-- Add it as an unrestricted action (like roi_ledger for paid plans, or always allowed).
-- Since ask_munshee is a core feature, allow it for all plans but count toward actions.

-- Already handled: if p_action_type doesn't match any known cap, it passes through
-- to the final deduction. 'ask_munshee' will be allowed for all plans.

-- ============================================================================
-- 4. Grants
-- ============================================================================

grant execute on function public.consume_action(uuid, text, int) to authenticated;
grant execute on function public.log_vision_extraction(uuid, text, text, text, text, int, numeric, boolean) to authenticated, service_role;