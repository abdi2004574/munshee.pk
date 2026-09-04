-- 0007_credits.sql
-- Phase 3: Credits & Subscription Layer
-- Adds credit_balance to tenants, credit_ledger, credit_costs, subscription_plans,
-- and claim_free_credits RPC.

-- ============================================================================
-- 1. tenants.credit_balance
-- ============================================================================

alter table public.tenants
  add column if not exists credit_balance numeric not null default 0;

-- ============================================================================
-- 2. credit_ledger
-- ============================================================================

create table if not exists public.credit_ledger (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  action_type  text not null check (action_type in (
    'text_extraction',
    'vision_extraction',
    'ask_munshee_query',
    'website_scrape',
    'plan_topup',
    'plan_subscription'
  )),
  credits_used numeric not null,
  balance_after numeric not null,
  reference_id text,
  created_at   timestamptz not null default now()
);

create index if not exists credit_ledger_tenant_created_idx
  on public.credit_ledger (tenant_id, created_at desc);

alter table public.credit_ledger enable row level security;

drop policy if exists credit_ledger_tenant_select on public.credit_ledger;
create policy credit_ledger_tenant_select on public.credit_ledger
  for select using (tenant_id = auth.uid());

drop policy if exists credit_ledger_tenant_insert on public.credit_ledger;
create policy credit_ledger_tenant_insert on public.credit_ledger
  for insert with check (tenant_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert on public.credit_ledger to authenticated;

-- ============================================================================
-- 3. credit_costs
-- ============================================================================

create table if not exists public.credit_costs (
  action_type text primary key,
  credits     numeric not null,
  updated_at  timestamptz not null default now()
);

alter table public.credit_costs enable row level security;

drop policy if exists credit_costs_authenticated_select on public.credit_costs;
create policy credit_costs_authenticated_select on public.credit_costs
  for select to authenticated using (true);

grant usage on schema public to authenticated;
grant select on public.credit_costs to authenticated;

insert into public.credit_costs (action_type, credits) values
  ('text_extraction', 1),
  ('vision_extraction', 2),
  ('ask_munshee_query', 0.5),
  ('website_scrape', 1)
on conflict (action_type) do nothing;

-- ============================================================================
-- 4. subscription_plans
-- ============================================================================

create table if not exists public.subscription_plans (
  id             text primary key,
  name           text not null,
  description    text,
  monthly_credits numeric not null,
  price_pkr      numeric not null,
  features       jsonb not null default '[]'::jsonb,
  is_active      boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;

drop policy if exists subscription_plans_active_select on public.subscription_plans;
create policy subscription_plans_active_select on public.subscription_plans
  for select to authenticated using (is_active);

drop trigger if exists subscription_plans_set_updated_at on public.subscription_plans;
create trigger subscription_plans_set_updated_at
  before update on public.subscription_plans
  for each row execute function public.handle_updated_at();

grant usage on schema public to authenticated;
grant select on public.subscription_plans to authenticated;

insert into public.subscription_plans (id, name, description, monthly_credits, price_pkr, features, sort_order) values
  ('free', 'Free', 'Get started with basic credits every month.', 5, 0,
   '["5 monthly credits","Text extraction","Basic support"]'::jsonb, 1),
  ('starter', 'Starter', 'For small shops that need more extraction power.', 50, 999,
   '["50 monthly credits","Text + Vision extraction","Ask Munshee queries","Priority support"]'::jsonb, 2),
  ('pro', 'Pro', 'For growing businesses with regular document processing.', 200, 2999,
   '["200 monthly credits","All extraction types","Unlimited Ask Munshee","Website scraping","Priority support"]'::jsonb, 3),
  ('enterprise', 'Enterprise', 'Unlimited potential with high-volume processing.', 1000, 9999,
   '["1000 monthly credits","All features included","Dedicated support","Custom integrations"]'::jsonb, 4)
on conflict (id) do nothing;

-- ============================================================================
-- 5. claim_free_credits RPC
-- ============================================================================
-- Sign convention: positive credits_used = deduction, negative = top-up.

create or replace function public.claim_free_credits(p_credits numeric default 5)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant      uuid := auth.uid();
  v_new_balance numeric;
begin
  if v_tenant is null then
    raise exception 'authentication required';
  end if;

  update public.tenants
    set credit_balance = credit_balance + p_credits
    where id = v_tenant
    returning credit_balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'tenant not found';
  end if;

  insert into public.credit_ledger (tenant_id, action_type, credits_used, balance_after, reference_id)
    values (v_tenant, 'plan_topup', -p_credits, v_new_balance, 'free_initial');
end;
$$;

grant execute on function public.claim_free_credits(numeric) to authenticated;