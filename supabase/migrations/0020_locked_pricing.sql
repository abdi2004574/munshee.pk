-- 0020_locked_pricing.sql
-- Pricing re-seeding and feature expansion: locked 4-tier plans, action_packs,
-- pack_purchases table, and reference_number on subscriptions.
-- Append-only migration: does not drop or recreate existing tables.

-- ============================================================================
-- 1. Plan Re-seeding (UPSERT on plans)
-- ============================================================================

insert into public.plans (id, name, price_pkr, actions_monthly, max_businesses, features, sort_order) values
  ('free', 'Free', 0, 150, 1,
   jsonb_build_object(
     'watermark', true,
     'rescans_monthly', 1,
     'digest', 'monthly',
     'voice_items', 5,
     'udhaar_drafts', 2,
     'invoices', 5,
     'ads_drafts', 0,
     'clients', 0,
     'roi_ledger', 'basic'
   ), 1),
  ('starter', 'Starter', 4500, 800, 1,
   jsonb_build_object(
     'watermark', false,
     'rescans', 'weekly',
     'digest', 'weekly',
     'voice_items', 40,
     'udhaar_drafts', 15,
     'invoices', 30,
     'ads_drafts', 0,
     'clients', 0
   ), 2),
  ('business', 'Business', 8500, 2000, 6,
   jsonb_build_object(
     'watermark', false,
     'rescans', 'daily',
     'digest', 'enriched',
     'voice_items', 150,
     'udhaar_drafts', 60,
     'invoices', 200,
     'ads_drafts', 5,
     'clients', 6,
     'reporting_export', true
   ), 3),
  ('os', 'OS', 19000, 5000, 10,
   jsonb_build_object(
     'watermark', false,
     'rescans', 'daily_instant',
     'digest', 'weekly_enriched',
     'voice_items', 500,
     'udhaar_full', true,
     'invoices_unlimited', true,
     'ads_drafts', 15,
     'clients', 10,
     'tax_ready', true,
     'roi_ledger', 'full'
   ), 4)
on conflict (id) do update set
  name = excluded.name,
  price_pkr = excluded.price_pkr,
  actions_monthly = excluded.actions_monthly,
  max_businesses = excluded.max_businesses,
  features = excluded.features,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ============================================================================
-- 2. New Table action_packs
-- ============================================================================

create table if not exists public.action_packs (
  sku           text primary key,
  actions       int not null,
  price_pkr     int not null,
  validity_days int not null default 90,
  eligible_plans text[] not null default '{free,starter,business,os}',
  created_at    timestamptz not null default now()
);

create index if not exists action_packs_sku_idx on public.action_packs (sku);

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
-- 3. Subscription Updates: add reference_number column
-- ============================================================================

alter table public.subscriptions
  add column if not exists reference_number text;

-- ============================================================================
-- 4. New Table pack_purchases
-- ============================================================================

create table if not exists public.pack_purchases (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.tenants(id) on delete cascade,
  sku            text not null,
  reference_number text,
  status         text not null default 'pending_payment'
                 check (status in ('pending_payment', 'active')),
  activated_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists pack_purchases_business_sku_unique
  on public.pack_purchases (business_id, sku)
  where status = 'pending_payment';

create index if not exists pack_purchases_business_idx on public.pack_purchases (business_id);
create index if not exists pack_purchases_status_idx on public.pack_purchases (status);

alter table public.pack_purchases enable row level security;

drop policy if exists pack_purchases_owner_select on public.pack_purchases;
create policy pack_purchases_owner_select on public.pack_purchases
  for select using (business_id = auth.uid() or public.is_admin());

drop policy if exists pack_purchases_owner_insert on public.pack_purchases;
create policy pack_purchases_owner_insert on public.pack_purchases
  for insert with check (business_id = auth.uid() or public.is_admin());

drop policy if exists pack_purchases_owner_update on public.pack_purchases;
create policy pack_purchases_owner_update on public.pack_purchases
  for update using (business_id = auth.uid() or public.is_admin());

grant select, insert, update on public.pack_purchases to authenticated;

-- ============================================================================
-- 5. Updated-at trigger for pack_purchases
-- ============================================================================

drop trigger if exists pack_purchases_set_updated_at on public.pack_purchases;
create trigger pack_purchases_set_updated_at
  before update on public.pack_purchases
  for each row execute function public.handle_updated_at();
