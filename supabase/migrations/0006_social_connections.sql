-- 0006_social_connections.sql
-- Phase 1.5: Social connect (Facebook/Instagram OAuth one-tap connect).
-- Adds the social_connections table to persist OAuth tokens and metadata
-- for connected Meta pages/accounts.

-- ============================================================================
-- 1. set_updated_at trigger function (idempotent; first defined in 0005)
-- ============================================================================

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
-- 2. social_connections table
-- ============================================================================
-- NOTE: access_token is stored in plaintext here for simplicity. In production
-- this column MUST be encrypted at rest (e.g. pgcrypto + envelope encryption
-- or a managed Vault) before persisting OAuth tokens to the database.

create table if not exists public.social_connections (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  provider        text not null check (provider in ('facebook','instagram')),
  page_id         text not null,
  page_name       text,
  access_token    text not null,
  token_expires_at timestamptz,
  last_sync_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- Safety-net columns in case the table pre-existed without them
alter table public.social_connections
  add column if not exists deleted_at timestamptz;

alter table public.social_connections
  add column if not exists token_expires_at timestamptz;

alter table public.social_connections
  add column if not exists last_sync_at timestamptz;

-- ============================================================================
-- 3. Indexes & unique constraint
-- ============================================================================

-- Idempotent unique constraint on (tenant_id, provider, page_id)
create unique index if not exists social_connections_tenant_provider_page_uidx
  on public.social_connections (tenant_id, provider, page_id)
  where deleted_at is null;

create index if not exists social_connections_tenant_idx
  on public.social_connections (tenant_id);

create index if not exists social_connections_tenant_provider_idx
  on public.social_connections (tenant_id, provider);

-- ============================================================================
-- 4. Row Level Security (tenant-scoped)
-- ============================================================================

alter table public.social_connections enable row level security;

drop policy if exists social_connections_tenant_select on public.social_connections;
create policy social_connections_tenant_select on public.social_connections
  for select using (tenant_id = auth.uid() and deleted_at is null);

drop policy if exists social_connections_tenant_insert on public.social_connections;
create policy social_connections_tenant_insert on public.social_connections
  for insert with check (tenant_id = auth.uid());

drop policy if exists social_connections_tenant_update on public.social_connections;
create policy social_connections_tenant_update on public.social_connections
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

drop policy if exists social_connections_tenant_delete on public.social_connections;
create policy social_connections_tenant_delete on public.social_connections
  for delete using (tenant_id = auth.uid());

-- ============================================================================
-- 5. updated_at trigger
-- ============================================================================

drop trigger if exists social_connections_set_updated_at on public.social_connections;
create trigger social_connections_set_updated_at
  before update on public.social_connections
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 6. Grants
-- ============================================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.social_connections to authenticated;

-- ============================================================================
-- 7. Comment on access_token (encryption guidance)
-- ============================================================================

comment on column public.social_connections.access_token is
  'OAuth access token. Must be encrypted at rest in production (e.g. pgcrypto envelope encryption).';

comment on table public.social_connections is
  'Connected Facebook / Instagram pages for a tenant. access_token is plaintext in dev only.';
