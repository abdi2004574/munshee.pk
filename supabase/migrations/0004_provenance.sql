-- 0004_provenance.sql
-- Phase 1.3a: provenance columns on commerce tables + import batches/queue + RPCs.

-- ============================================================================
-- 1. Add provenance columns to existing commerce tables
-- ============================================================================

alter table public.products
  add column if not exists source_type text not null default 'manual',
  add column if not exists confidence_score numeric(3,2),
  add column if not exists verbatim_quote text,
  add column if not exists needs_review boolean not null default false,
  add column if not exists reviewed_at timestamptz;

alter table public.products
  drop constraint if exists products_confidence_score_check;

alter table public.products
  add constraint products_confidence_score_check
  check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1));

alter table public.product_variants
  add column if not exists source_type text not null default 'manual',
  add column if not exists confidence_score numeric(3,2),
  add column if not exists verbatim_quote text,
  add column if not exists needs_review boolean not null default false,
  add column if not exists reviewed_at timestamptz;

alter table public.product_variants
  drop constraint if exists product_variants_confidence_score_check;

alter table public.product_variants
  add constraint product_variants_confidence_score_check
  check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1));

alter table public.customers
  add column if not exists source_type text not null default 'manual',
  add column if not exists confidence_score numeric(3,2),
  add column if not exists verbatim_quote text,
  add column if not exists needs_review boolean not null default false,
  add column if not exists reviewed_at timestamptz;

alter table public.customers
  drop constraint if exists customers_confidence_score_check;

alter table public.customers
  add constraint customers_confidence_score_check
  check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1));

alter table public.inventory_levels
  add column if not exists source_type text not null default 'manual',
  add column if not exists confidence_score numeric(3,2),
  add column if not exists verbatim_quote text,
  add column if not exists needs_review boolean not null default false,
  add column if not exists reviewed_at timestamptz;

alter table public.inventory_levels
  drop constraint if exists inventory_levels_confidence_score_check;

alter table public.inventory_levels
  add constraint inventory_levels_confidence_score_check
  check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1));

create index if not exists products_needs_review_idx
  on public.products (tenant_id, needs_review)
  where needs_review = true;

create index if not exists product_variants_needs_review_idx
  on public.product_variants (tenant_id, needs_review)
  where needs_review = true;

create index if not exists customers_needs_review_idx
  on public.customers (tenant_id, needs_review)
  where needs_review = true;

create index if not exists inventory_levels_needs_review_idx
  on public.inventory_levels (tenant_id, needs_review)
  where needs_review = true;

-- ============================================================================
-- 2. import_batches table
-- ============================================================================

create table if not exists public.import_batches (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  file_name       text not null,
  table_name      text not null,
  total_rows      int not null default 0,
  processed_rows  int not null default 0,
  status          text not null default 'pending'
                    check (status in ('pending','processing','review','completed','failed')),
  error_log       jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists import_batches_tenant_idx
  on public.import_batches (tenant_id);

alter table public.import_batches enable row level security;

drop policy if exists import_batches_tenant_select on public.import_batches;
create policy import_batches_tenant_select on public.import_batches
  for select using (tenant_id = auth.uid());

drop policy if exists import_batches_tenant_insert on public.import_batches;
create policy import_batches_tenant_insert on public.import_batches
  for insert with check (tenant_id = auth.uid());

drop policy if exists import_batches_tenant_update on public.import_batches;
create policy import_batches_tenant_update on public.import_batches
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

drop policy if exists import_batches_tenant_delete on public.import_batches;
create policy import_batches_tenant_delete on public.import_batches
  for delete using (tenant_id = auth.uid());

drop trigger if exists import_batches_set_updated_at on public.import_batches;
create trigger import_batches_set_updated_at
  before update on public.import_batches
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.import_batches to authenticated;

-- ============================================================================
-- 3. import_queue table
-- ============================================================================

create table if not exists public.import_queue (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  batch_id         uuid not null references public.import_batches(id) on delete cascade,
  table_name       text not null,
  payload          jsonb not null default '{}'::jsonb,
  source_type      text not null default 'csv_import',
  confidence_score numeric(3,2),
  verbatim_quote   text,
  needs_review     boolean not null default true,
  reviewed_at      timestamptz,
  status           text not null default 'pending'
                     check (status in ('pending','approved','rejected','error')),
  error_message    text,
  target_row_id    uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists import_queue_needs_review_idx
  on public.import_queue (tenant_id, needs_review)
  where needs_review = true;

create index if not exists import_queue_batch_idx
  on public.import_queue (batch_id);

create index if not exists import_queue_tenant_idx
  on public.import_queue (tenant_id);

alter table public.import_queue enable row level security;

drop policy if exists import_queue_tenant_select on public.import_queue;
create policy import_queue_tenant_select on public.import_queue
  for select using (tenant_id = auth.uid());

drop policy if exists import_queue_tenant_insert on public.import_queue;
create policy import_queue_tenant_insert on public.import_queue
  for insert with check (tenant_id = auth.uid());

drop policy if exists import_queue_tenant_update on public.import_queue;
create policy import_queue_tenant_update on public.import_queue
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

drop policy if exists import_queue_tenant_delete on public.import_queue;
create policy import_queue_tenant_delete on public.import_queue
  for delete using (tenant_id = auth.uid());

drop trigger if exists import_queue_set_updated_at on public.import_queue;
create trigger import_queue_set_updated_at
  before update on public.import_queue
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.import_queue to authenticated;

-- ============================================================================
-- 4. approve_import_item RPC
-- ============================================================================

create or replace function public.approve_import_item(p_queue_id uuid, p_target_row_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := auth.uid();
  v_table text;
  v_sql text;
begin
  if v_tenant is null then
    raise exception 'authentication required';
  end if;

  select table_name
    into v_table
    from public.import_queue
   where id = p_queue_id
     and tenant_id = v_tenant
     and status = 'pending'
   for update;
  if not found then
    raise exception 'queue item not found or not pending';
  end if;

  if v_table not in ('products','product_variants','customers','inventory_levels') then
    raise exception 'table % is not allowed', v_table;
  end if;

  update public.import_queue
     set status        = 'approved',
         reviewed_at   = now(),
         target_row_id = p_target_row_id,
         needs_review  = false
   where id = p_queue_id
     and tenant_id = v_tenant;

  v_sql := format(
    'update public.%I set needs_review = false, reviewed_at = now() where id = $1 and tenant_id = $2',
    v_table
  );
  execute v_sql using p_target_row_id, v_tenant;
end;
$$;

grant execute on function public.approve_import_item(uuid, uuid) to authenticated;

-- ============================================================================
-- 5. reject_import_item RPC
-- ============================================================================

create or replace function public.reject_import_item(p_queue_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := auth.uid();
  v_target_id uuid;
begin
  if v_tenant is null then
    raise exception 'authentication required';
  end if;

  update public.import_queue
     set status       = 'rejected',
         reviewed_at  = now(),
         needs_review = false
   where id = p_queue_id
     and tenant_id = v_tenant
     and status = 'pending'
   returning target_row_id into v_target_id;

  if not found then
    raise exception 'queue item not found or not pending';
  end if;

  if v_target_id is not null then
    begin
      perform public.soft_delete_commerce_row(
        (select table_name from public.import_queue where id = p_queue_id and tenant_id = v_tenant),
        v_target_id
      );
    exception when others then
      raise exception 'failed to soft-delete target row: %', sqlerrm;
    end;
  end if;
end;
$$;

grant execute on function public.reject_import_item(uuid) to authenticated;
