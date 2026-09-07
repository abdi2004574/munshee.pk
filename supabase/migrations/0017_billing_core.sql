-- 0017_billing_core.sql
-- Billing foundations with LOCKED 4-tier pricing, action packs, dual-counter gating.
-- No payment gateway — manual admin activation.
-- Append-only migration.

-- ============================================================================
-- 1. plans (LOCKED — never edited by merchant)
-- ============================================================================

create table if not exists public.plans (
  id              text primary key,
  name            text not null,
  price_pkr       numeric not null,
  actions_monthly int not null,
  max_businesses  int not null default 1,
  features        jsonb not null default '{}'::jsonb,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.handle_updated_at();

alter table public.plans enable row level security;

drop policy if exists plans_authenticated_select on public.plans;
create policy plans_authenticated_select on public.plans
  for select to authenticated using (true);

grant usage on schema public to authenticated;
grant select on public.plans to authenticated;

insert into public.plans (id, name, price_pkr, actions_monthly, max_businesses, features, sort_order) values
  ('free', 'Free', 0, 150, 0,
   '{"watermark":true,"rescans":"monthly","digest":"monthly","voice_items":5,"udhaar_drafts":2,"invoices":5,"ads_drafts":0,"clients":0,"roi_ledger":"basic"}'::jsonb, 1),
  ('starter', 'Starter', 4500, 800, 1,
   '{"watermark":false,"rescans":"weekly","digest":"weekly","voice_items":40,"udhaar_drafts":15,"invoices":30,"ads_drafts":0,"clients":0}'::jsonb, 2),
  ('business', 'Business', 8500, 2000, 6,
   '{"watermark":false,"rescans":"daily","digest":"enriched","voice_items":150,"udhaar_drafts":60,"invoices":200,"ads_drafts":5,"clients":6,"reporting_export":true}'::jsonb, 3),
  ('os', 'OS', 19000, 5000, 10,
   '{"watermark":false,"rescans":"daily_instant","digest":"enriched","voice_items":500,"udhaar_full":true,"invoices":"unlimited","ads_drafts":15,"clients":10,"tax_ready":true,"roi_ledger":"full"}'::jsonb, 4)
on conflict (id) do nothing;

-- ============================================================================
-- 2. subscriptions
-- ============================================================================

create table if not exists public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.tenants(id) on delete cascade,
  plan_id         text not null references public.plans(id),
  status          text not null default 'trial' check (status in ('active','pending_payment','expired','trial')),
  period_start    timestamptz,
  period_end      timestamptz,
  admin_granted   boolean not null default false,
  actions_remaining int not null default 0,
  last_grant_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint subscriptions_business_unique unique (business_id)
);

create index if not exists subscriptions_business_idx
  on public.subscriptions (business_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_owner_select on public.subscriptions;
create policy subscriptions_owner_select on public.subscriptions
  for select using (business_id = auth.uid());

drop policy if exists subscriptions_owner_insert on public.subscriptions;
create policy subscriptions_owner_insert on public.subscriptions
  for insert with check (business_id = auth.uid());

drop policy if exists subscriptions_owner_update on public.subscriptions;
create policy subscriptions_owner_update on public.subscriptions
  for update using (business_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update on public.subscriptions to authenticated;

-- ============================================================================
-- 3. action_packs (LOCKED)
-- ============================================================================

create table if not exists public.action_packs (
  sku           text primary key,
  actions       int not null,
  price_pkr     numeric not null,
  validity_days int not null default 90,
  created_at    timestamptz not null default now()
);

alter table public.action_packs enable row level security;

drop policy if exists action_packs_authenticated_select on public.action_packs;
create policy action_packs_authenticated_select on public.action_packs
  for select to authenticated using (true);

grant usage on schema public to authenticated;
grant select on public.action_packs to authenticated;

insert into public.action_packs (sku, actions, price_pkr, validity_days) values
  ('pack_100', 100, 800, 90),
  ('pack_250', 250, 1800, 90),
  ('pack_500', 500, 3000, 90)
on conflict (sku) do nothing;

-- ============================================================================
-- 4. credit_ledger (pack credits with expiry)
-- ============================================================================

create table if not exists public.credit_ledger (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.tenants(id) on delete cascade,
  delta          int not null,
  reason         text not null,
  balance_after  int not null,
  expires_at     timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists credit_ledger_business_created_idx
  on public.credit_ledger (business_id, created_at desc);

alter table public.credit_ledger enable row level security;

drop policy if exists credit_ledger_owner_select on public.credit_ledger;
create policy credit_ledger_owner_select on public.credit_ledger
  for select using (business_id = auth.uid());

drop policy if exists credit_ledger_owner_insert on public.credit_ledger;
create policy credit_ledger_owner_insert on public.credit_ledger
  for insert with check (business_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert on public.credit_ledger to authenticated;

-- ============================================================================
-- 5. Helper: get_feature_flags
-- Returns plan features + actions_left + subscription_status for frontend gating.
-- ============================================================================

create or replace function public.get_feature_flags(
  p_business_id uuid
)
returns table (
  plan_id text,
  plan_name text,
  features jsonb,
  actions_left int,
  subscription_status text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id        as plan_id,
    p.name      as plan_name,
    p.features,
    coalesce(s.actions_remaining, 0) as actions_left,
    coalesce(s.status, 'trial')       as subscription_status
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.business_id = p_business_id;
$$;

grant execute on function public.get_feature_flags(uuid) to authenticated;

-- ============================================================================
-- 6. Helper: ensure_monthly_grant_by_business
-- Lazy monthly grant on read. If last_grant_at > 30 days ago, top-up actions_monthly.
-- ============================================================================

create or replace function public.ensure_monthly_grant_by_business(
  p_business_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription   record;
  v_plan           record;
  v_new_remaining  int;
begin
  select * into v_subscription
  from public.subscriptions
  where business_id = p_business_id
  limit 1;

  if not found then
    -- No subscription yet — create trial with free plan
    insert into public.subscriptions (business_id, plan_id, status, actions_remaining, last_grant_at)
    values (p_business_id, 'free', 'trial', 150, now())
    returning * into v_subscription;
    return 150;
  end if;

  if v_subscription.last_grant_at is null or now() - v_subscription.last_grant_at > interval '30 days' then
    select * into v_plan from public.plans where id = v_subscription.plan_id;

    update public.subscriptions
    set actions_remaining = v_plan.actions_monthly,
        last_grant_at = now(),
        updated_at = now()
    where business_id = p_business_id
    returning actions_remaining into v_new_remaining;

    return coalesce(v_new_remaining, 0);
  end if;

  return v_subscription.actions_remaining;
end;
$$;

grant execute on function public.ensure_monthly_grant_by_business(uuid) to authenticated;

-- ============================================================================
-- 7. Helper: get_current_plan
-- Returns plan + subscription + effective actions_left (after lazy grant).
-- ============================================================================

create or replace function public.get_current_plan(
  p_business_id uuid
)
returns table (
  plan_id text,
  plan_name text,
  price_pkr numeric,
  actions_monthly int,
  max_businesses int,
  features jsonb,
  subscription_status text,
  period_start timestamptz,
  period_end timestamptz,
  admin_granted boolean,
  actions_left int
)
language sql
security definer
set search_path = public
as $$
  with granted as (
    select public.ensure_monthly_grant_by_business(p_business_id) as actions_left
  )
  select
    p.id,
    p.name,
    p.price_pkr,
    p.actions_monthly,
    p.max_businesses,
    p.features,
    s.status,
    s.period_start,
    s.period_end,
    s.admin_granted,
    g.actions_left
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  cross join granted g
  where s.business_id = p_business_id;
$$;

grant execute on function public.get_current_plan(uuid) to authenticated;

-- ============================================================================
-- 8. Helper: consume_action
-- Dual-counter gating:
--   1) Actions balance (subscriptions.actions_remaining)
--   2) Feature caps (plans.features jsonb)
-- Returns ok=true + actions_left, or 402 with code ACTIONS_EXHAUSTED | FEATURE_CAP.
-- ============================================================================

create or replace function public.consume_action(
  p_business_id  uuid,
  p_action_type  text
)
returns table (
  ok boolean,
  actions_left int,
  code text,
  feature text
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
  if v_sub.actions_remaining <= 0 then
    return query select false, 0, 'ACTIONS_EXHAUSTED', null::text;
    return;
  end if;

  -- 2) Feature cap check
  v_feat := v_plan.features;

  if p_action_type = 'udhaar_draft' then
    v_limit := coalesce((v_feat->>'udhaar_drafts')::int, 0);
    if v_limit = 0 then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'udhaar_drafts';
      return;
    end if;
    -- Count drafts used this month (approximate via action_ledger)
    select count(*) into v_used
    from public.action_ledger
    where business_id = p_business_id
      and tool_name = 'udhaar_draft'
      and created_at >= date_trunc('month', now());
    if v_used >= v_limit then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'udhaar_drafts';
      return;
    end if;
  end if;

  if p_action_type = 'invoice' then
    v_limit := coalesce((v_feat->>'invoices')::int, 0);
    if v_limit = 0 then
      -- "unlimited" is represented as 0 in the json for OS plan, or negative
      -- But if it's literally 0 for free, block
      if v_sub.plan_id = 'free' then
        return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'invoices';
        return;
      end if;
    else
      select count(*) into v_used
      from public.action_ledger
      where business_id = p_business_id
        and tool_name = 'invoice'
        and created_at >= date_trunc('month', now());
      if v_used >= v_limit then
        return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'invoices';
        return;
      end if;
    end if;
  end if;

  if p_action_type = 'voice_digest' then
    v_limit := coalesce((v_feat->>'voice_items')::int, 0);
    if v_limit = 0 then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'voice_items';
      return;
    end if;
    select count(*) into v_used
    from public.action_ledger
    where business_id = p_business_id
      and tool_name = 'voice_digest'
      and created_at >= date_trunc('month', now());
    if v_used >= v_limit then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'voice_items';
      return;
    end if;
  end if;

  if p_action_type = 'ad_draft' then
    v_limit := coalesce((v_feat->>'ads_drafts')::int, 0);
    if v_limit = 0 then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'ads_drafts';
      return;
    end if;
    select count(*) into v_used
    from public.action_ledger
    where business_id = p_business_id
      and tool_name = 'ad_draft'
      and created_at >= date_trunc('month', now());
    if v_used >= v_limit then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'ads_drafts';
      return;
    end if;
  end if;

  if p_action_type = 'client' then
    v_limit := coalesce((v_feat->>'clients')::int, 0);
    if v_limit = 0 then
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'clients';
      return;
    end if;
  end if;

  if p_action_type = 'rescan' then
    if v_feat->>'rescans' in ('weekly', 'daily', 'daily_instant') then
      null; -- allowed
    else
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'rescans';
      return;
    end if;
  end if;

  if p_action_type = 'roi_ledger' then
    if v_sub.plan_id in ('business', 'os') then
      null; -- allowed
    else
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'roi_ledger';
      return;
    end if;
  end if;

  if p_action_type = 'reporting_export' then
    if v_feat->>'reporting_export' = 'true' then
      null; -- allowed
    else
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'reporting_export';
      return;
    end if;
  end if;

  if p_action_type = 'tax_ready' then
    if v_feat->>'tax_ready' = 'true' then
      null; -- allowed
    else
      return query select false, v_sub.actions_remaining, 'FEATURE_CAP', 'tax_ready';
      return;
    end if;
  end if;

  -- Deduct action
  update public.subscriptions
  set actions_remaining = actions_remaining - 1,
      updated_at = now()
  where business_id = p_business_id
  returning actions_remaining into v_new_remaining;

  return query select true, coalesce(v_new_remaining, v_sub.actions_remaining - 1), null::text, null::text;
end;
$$;

grant execute on function public.consume_action(uuid, text) to authenticated;

-- ============================================================================
-- 9. Helper: purchase_action_pack
-- Creates a pending_payment subscription row for the pack.
-- Admin activation adds credits to credit_ledger with expiry.
-- ============================================================================

create or replace function public.purchase_action_pack(
  p_business_id uuid,
  p_pack_sku    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pack      record;
  v_sub_id    uuid;
  v_now       timestamptz := now();
begin
  select * into v_pack from public.action_packs where sku = p_pack_sku;
  if not found then
    raise exception 'pack not found: %', p_pack_sku;
  end if;

  -- Create or update a pending_payment subscription for this pack purchase
  insert into public.subscriptions (business_id, plan_id, status, period_start, period_end, admin_granted, actions_remaining, last_grant_at)
  values (p_business_id, 'pack_' || p_pack_sku, 'pending_payment', v_now, v_now + (v_pack.validity_days || ' days')::interval, false, 0, null)
  on conflict (business_id) do update
    set plan_id = 'pack_' || p_pack_sku,
        status = 'pending_payment',
        period_start = v_now,
        period_end = v_now + (v_pack.validity_days || ' days')::interval,
        admin_granted = false,
        actions_remaining = 0,
        last_grant_at = null,
        updated_at = v_now
  returning id into v_sub_id;

  return v_sub_id;
end;
$$;

grant execute on function public.purchase_action_pack(uuid, text) to authenticated;

-- ============================================================================
-- 10. Helper: activate_action_pack (admin only)
-- Admin grants pack credits to a pending subscription.
-- ============================================================================

create or replace function public.activate_action_pack(
  p_subscription_id uuid,
  p_credit_amount   int,
  p_expires_at      timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'subscription not found';
  end if;

  update public.subscriptions
  set status = 'active',
      admin_granted = true,
      actions_remaining = p_credit_amount,
      last_grant_at = now(),
      updated_at = now()
  where id = p_subscription_id;

  insert into public.credit_ledger (business_id, delta, reason, balance_after, expires_at)
  values (v_sub.business_id, p_credit_amount, 'pack_activation', p_credit_amount, p_expires_at);
end;
$$;

grant execute on function public.activate_action_pack(uuid, int, timestamptz) to service_role;

-- ============================================================================
-- 11. Helper: get_credit_ledger
-- ============================================================================

create or replace function public.get_credit_ledger(
  p_business_id uuid,
  p_limit int default 50
)
returns table (
  id uuid,
  delta int,
  reason text,
  balance_after int,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, delta, reason, balance_after, expires_at, created_at
  from public.credit_ledger
  where business_id = p_business_id
  order by created_at desc
  limit p_limit;
$$;

grant execute on function public.get_credit_ledger(uuid, int) to authenticated;

-- ============================================================================
-- 12. Recalculate subscription status based on period_end
-- ============================================================================

create or replace function public.recalculate_subscription_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and new.period_end is not null and new.period_end < now() then
    new.status := 'expired';
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_recalculate_status on public.subscriptions;
create trigger subscriptions_recalculate_status
  before insert or update on public.subscriptions
  for each row execute function public.recalculate_subscription_status();