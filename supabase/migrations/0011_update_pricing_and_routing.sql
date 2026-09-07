-- 0011_update_pricing_and_routing.sql
-- Phase: Finalized pricing, credit costs, and centralized AI model routing config.

-- ============================================================================
-- 1. Update credit_costs to finalized values
-- ============================================================================
-- ask_munshee_query changes from 0.5 to 1 credit.

update public.credit_costs
   set credits = 1,
       updated_at = now()
 where action_type = 'ask_munshee_query';

-- Ensure all expected action types exist (idempotent)
insert into public.credit_costs (action_type, credits) values
  ('plan_subscription', 0)
on conflict (action_type) do nothing;

-- ============================================================================
-- 2. Update subscription_plans to finalized pricing
-- ============================================================================
-- Starter: 2,500 PKR/mo (300 credits, 9 PKR/top-up credit)
-- Growth: 5,000 PKR/mo (700 credits, 8 PKR/top-up credit)
-- Business: 10,000 PKR/mo (1,800 credits, 6 PKR/top-up credit)

-- Remove old plans that no longer match finalized pricing
delete from public.subscription_plans
 where id in ('pro', 'enterprise');

-- Upsert finalized plans
insert into public.subscription_plans (id, name, description, monthly_credits, price_pkr, features, sort_order) values
  ('free', 'Free', 'Get started with basic credits every month.', 5, 0,
   '["5 monthly credits","Text extraction","Basic support"]'::jsonb, 1),
  ('starter', 'Starter', 'For small shops that need more extraction power.', 300, 2500,
   '["300 monthly credits","Text + Vision extraction","Ask Munshee queries","Priority support","9 PKR/top-up credit"]'::jsonb, 2),
  ('growth', 'Growth', 'For growing businesses with regular document processing.', 700, 5000,
   '["700 monthly credits","All extraction types","Unlimited Ask Munshee","Website scraping","Priority support","8 PKR/top-up credit"]'::jsonb, 3),
  ('business', 'Business', 'Unlimited potential with high-volume processing.', 1800, 10000,
   '["1800 monthly credits","All features included","Dedicated support","Custom integrations","6 PKR/top-up credit"]'::jsonb, 4)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_credits = excluded.monthly_credits,
  price_pkr = excluded.price_pkr,
  features = excluded.features,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Add top_up_rate_pkr column if it doesn't exist
alter table public.subscription_plans
  add column if not exists top_up_rate_pkr numeric not null default 0;

update public.subscription_plans
   set top_up_rate_pkr = case id
     when 'starter' then 9
     when 'growth' then 8
     when 'business' then 6
     else 0
   end
 where id in ('starter', 'growth', 'business');

-- ============================================================================
-- 3. model_routing_config table
-- ============================================================================
-- Centralized configuration for AI model routing by tenant tier.
-- Paid tier uses premium OpenRouter models.
-- Trial/Free tier uses :free variants subject to shared rate limits.

create table if not exists public.model_routing_config (
  tier            text not null check (tier in ('paid', 'trial')),
  function_name   text not null check (function_name in ('extract-text', 'extract-vision', 'ask-munshee')),
  model           text not null,
  fallback_model  text not null,
  updated_at      timestamptz not null default now(),
  primary key (tier, function_name)
);

alter table public.model_routing_config enable row level security;

drop policy if exists model_routing_config_select on public.model_routing_config;
create policy model_routing_config_select on public.model_routing_config
  for select to authenticated using (true);

grant usage on schema public to authenticated;
grant select on public.model_routing_config to authenticated;

-- Seed routing config
insert into public.model_routing_config (tier, function_name, model, fallback_model) values
  ('paid',   'extract-text',  'meta-llama/llama-3.3-70b-instruct', 'meta-llama/llama-3.3-70b-instruct:free'),
  ('paid',   'extract-vision', 'qwen/qwen-2.5-vl-72b',             'qwen/qwen-2.5-vl-72b:free'),
  ('paid',   'ask-munshee',   'meta-llama/llama-3.3-70b-instruct', 'meta-llama/llama-3.3-70b-instruct:free'),
  ('trial',  'extract-text',  'meta-llama/llama-3.3-70b-instruct:free', 'meta-llama/llama-3.3-70b-instruct:free'),
  ('trial',  'extract-vision', 'qwen/qwen-2.5-vl-72b:free',             'qwen/qwen-2.5-vl-72b:free'),
  ('trial',  'ask-munshee',   'meta-llama/llama-3.3-70b-instruct:free', 'meta-llama/llama-3.3-70b-instruct:free')
on conflict (tier, function_name) do update set
  model = excluded.model,
  fallback_model = excluded.fallback_model,
  updated_at = now();

-- ============================================================================
-- 4. Helper RPC: get_tenant_model_tier
-- ============================================================================
-- Returns 'paid' if the tenant has a completed subscription payment for a non-free plan,
-- otherwise returns 'trial'.

create or replace function public.get_tenant_model_tier(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tenant_id is null then
    return 'trial';
  end if;

  if exists (
    select 1
      from public.payment_transactions pt
      join public.subscription_plans sp on sp.id = pt.plan_id
     where pt.tenant_id = p_tenant_id
       and pt.status = 'completed'
       and sp.id != 'free'
       and sp.price_pkr > 0
  ) then
    return 'paid';
  end if;

  return 'trial';
end;
$$;

grant execute on function public.get_tenant_model_tier(uuid) to authenticated;
