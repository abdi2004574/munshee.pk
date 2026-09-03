-- 0005_business_facts.sql
-- Phase 1.4: Business Brain fact-extraction system.
-- Adds public-facing business profiles, structured fact storage, audit log,
-- Q&A logging, public read view, and view-count RPC.

-- ============================================================================
-- 1. public.set_updated_at trigger function
-- ============================================================================
-- Already defined in 0002_commerce.sql; recreate here as idempotent.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 2. businesses table
-- ============================================================================

drop table if exists public.businesses cascade;
create table public.businesses (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  slug          text not null unique,
  display_name  text not null,
  description   text,
  views_count   int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

alter table public.businesses
  add column if not exists deleted_at timestamptz;

alter table public.businesses
  add column if not exists slug text;

alter table public.businesses
  add column if not exists display_name text;

alter table public.businesses
  add column if not exists views_count int default 0;

create unique index if not exists businesses_slug_active_uidx
  on public.businesses (slug)
  where deleted_at is null;

create index if not exists businesses_tenant_idx
  on public.businesses (tenant_id);

alter table public.businesses enable row level security;

drop policy if exists businesses_tenant_select on public.businesses;
create policy businesses_tenant_select on public.businesses
  for select using (tenant_id = auth.uid() and deleted_at is null);

drop policy if exists businesses_tenant_insert on public.businesses;
create policy businesses_tenant_insert on public.businesses
  for insert with check (tenant_id = auth.uid());

drop policy if exists businesses_tenant_update on public.businesses;
create policy businesses_tenant_update on public.businesses
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

drop policy if exists businesses_tenant_delete on public.businesses;
create policy businesses_tenant_delete on public.businesses
  for delete using (tenant_id = auth.uid());

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.businesses to authenticated;

-- ============================================================================
-- 3. business_facts table
-- ============================================================================

drop table if exists public.business_facts cascade;
create table public.business_facts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  category      text not null check (category in (
                  'product','pricing','policy','contact','hours',
                  'location','service_area','brand_voice')),
  label         text not null,
  value         text not null,
  confidence    numeric(3,2) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status        text not null default 'needs_review'
                  check (status in ('needs_review','confirmed','rejected')),
  source_type   text not null,
  source_ref    text,
  linked_table  text,
  linked_row_id uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists business_facts_tenant_category_idx
  on public.business_facts (tenant_id, category);

create index if not exists business_facts_tenant_status_idx
  on public.business_facts (tenant_id, status);

create index if not exists business_facts_tenant_source_type_idx
  on public.business_facts (tenant_id, source_type);

create index if not exists business_facts_tenant_linked_idx
  on public.business_facts (tenant_id, linked_table, linked_row_id);

alter table public.business_facts enable row level security;

drop policy if exists business_facts_tenant_select on public.business_facts;
create policy business_facts_tenant_select on public.business_facts
  for select using (tenant_id = auth.uid() and deleted_at is null);

drop policy if exists business_facts_tenant_insert on public.business_facts;
create policy business_facts_tenant_insert on public.business_facts
  for insert with check (tenant_id = auth.uid());

drop policy if exists business_facts_tenant_update on public.business_facts;
create policy business_facts_tenant_update on public.business_facts
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

drop policy if exists business_facts_tenant_delete on public.business_facts;
create policy business_facts_tenant_delete on public.business_facts
  for delete using (tenant_id = auth.uid());

drop trigger if exists business_facts_set_updated_at on public.business_facts;
create trigger business_facts_set_updated_at
  before update on public.business_facts
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.business_facts to authenticated;

-- ============================================================================
-- 4. audit_log table (append-only)
-- ============================================================================

drop table if exists public.audit_log cascade;
create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  fact_id    uuid references public.business_facts(id) on delete set null,
  actor      uuid not null,
  action     text not null check (action in ('confirm','edit','delete','import')),
  old_value  jsonb,
  new_value  jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_tenant_fact_idx
  on public.audit_log (tenant_id, fact_id);

create index if not exists audit_log_tenant_created_at_idx
  on public.audit_log (tenant_id, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists audit_log_tenant_select on public.audit_log;
create policy audit_log_tenant_select on public.audit_log
  for select using (tenant_id = auth.uid());

drop policy if exists audit_log_tenant_insert on public.audit_log;
create policy audit_log_tenant_insert on public.audit_log
  for insert with check (tenant_id = auth.uid());

grant select, insert on public.audit_log to authenticated;

-- ============================================================================
-- 5. ask_logs table (append-only)
-- ============================================================================

drop table if exists public.ask_logs cascade;
create table public.ask_logs (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  question   text not null,
  answer     text not null,
  created_at timestamptz not null default now()
);

create index if not exists ask_logs_tenant_created_at_idx
  on public.ask_logs (tenant_id, created_at desc);

alter table public.ask_logs enable row level security;

drop policy if exists ask_logs_tenant_select on public.ask_logs;
create policy ask_logs_tenant_select on public.ask_logs
  for select using (tenant_id = auth.uid());

drop policy if exists ask_logs_tenant_insert on public.ask_logs;
create policy ask_logs_tenant_insert on public.ask_logs
  for insert with check (tenant_id = auth.uid());

grant select, insert on public.ask_logs to authenticated;

-- ============================================================================
-- 6. public.public_profile view (read-only, public-facing confirmed facts)
-- ============================================================================

-- Ensure deleted_at exists on business_facts if table was created without it
alter table public.business_facts
  add column if not exists deleted_at timestamptz;

create or replace view public.public_profile as
  select tenant_id, category, label, value
    from public.business_facts
   where status = 'confirmed' and deleted_at is null;

grant select on public.public_profile to anon, authenticated;

-- ============================================================================
-- 7. public.increment_views RPC
-- ============================================================================

drop function if exists public.increment_views(uuid);

create or replace function public.increment_views(p_tenant_id uuid)

returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.businesses
     set views_count = views_count + 1
   where tenant_id = p_tenant_id;
end;
$$;

grant execute on function public.increment_views(uuid) to authenticated, anon;
