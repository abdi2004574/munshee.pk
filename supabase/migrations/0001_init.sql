-- 0001_init.sql
-- Phase 1.1 foundation schema: tenants, profiles, app_settings.
-- Single-tenant-per-user model: profiles.tenant_id = profiles.user_id.

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists public.tenants (
  id          uuid primary key,
  display_name text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id         uuid primary key,
  tenant_id  uuid not null,
  full_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  tenant_id  uuid primary key,
  locale     text not null default 'en-PK',
  currency   text not null default 'PKR',
  timezone   text not null default 'Asia/Karachi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Foreign keys
-- ============================================================================

alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

alter table public.profiles
  add constraint profiles_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete cascade;

alter table public.app_settings
  add constraint app_settings_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete cascade;

-- ============================================================================
-- updated_at trigger
-- ============================================================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.app_settings;
create trigger set_updated_at
  before update on public.app_settings
  for each row execute function public.handle_updated_at();

-- ============================================================================
-- Auto-provision on signup
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenants (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>''full_name'', ''My Business''));

  insert into public.profiles (id, tenant_id, full_name)
  values (new.id, new.id, new.raw_user_meta_data->>''full_name'');

  insert into public.app_settings (tenant_id)
  values (new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.tenants       enable row level security;
alter table public.profiles      enable row level security;
alter table public.app_settings  enable row level security;

-- Tenants: owner-only by id = auth.uid()
create policy "tenants_owner_select" on public.tenants
  for select using (id = auth.uid());
create policy "tenants_owner_update" on public.tenants
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "tenants_owner_delete" on public.tenants
  for delete using (id = auth.uid());

-- Profiles: owner-only by id = auth.uid()
create policy "profiles_owner_select" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_owner_update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_owner_delete" on public.profiles
  for delete using (id = auth.uid());

-- App settings: owner-only by tenant_id = auth.uid()
create policy "app_settings_owner_select" on public.app_settings
  for select using (tenant_id = auth.uid());
create policy "app_settings_owner_update" on public.app_settings
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "app_settings_owner_delete" on public.app_settings
  for delete using (tenant_id = auth.uid());

-- ============================================================================
-- Grants
-- ============================================================================

grant usage on schema public to authenticated;
grant all on public.tenants to authenticated;
grant all on public.profiles to authenticated;
grant all on public.app_settings to authenticated;
grant usage, select on all sequences in schema public to authenticated;
