create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    sku text NOT NULL,
    title text NOT NULL,
    description text,
    category text NOT NULL DEFAULT 'uncategorized',
    brand text,
    status text NOT NULL DEFAULT 'draft' check (status in ('active','draft','archived')),
    tags text[] NOT NULL DEFAULT '{}',
    weight_grams int,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
create unique index products_tenant_sku_unique on public.products (tenant_id, sku) where deleted_at is null;
create index products_tenant_status_idx on public.products (tenant_id, status) where deleted_at is null;
create index products_tenant_category_idx on public.products (tenant_id, category) where deleted_at is null;
create index products_tags_gin on public.products using gin (tags) where deleted_at is null;
alter table public.products enable row level security;
drop policy if exists products_tenant_select on public.products;
create policy products_tenant_select on public.products for select using (tenant_id = auth.uid() and deleted_at is null);
drop policy if exists products_tenant_insert on public.products;
create policy products_tenant_insert on public.products for insert with check (tenant_id = auth.uid());
drop policy if exists products_tenant_update on public.products;
create policy products_tenant_update on public.products for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
drop policy if exists products_tenant_delete on public.products;
create policy products_tenant_delete on public.products for delete using (tenant_id = auth.uid());
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();

create table public.product_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    product_id uuid NOT NULL references public.products(id) on delete cascade,
    sku text NOT NULL,
    title text NOT NULL,
    price_paise bigint NOT NULL check (price_paise >= 0),
    compare_at_paise bigint check (compare_at_paise >= 0),
    cost_paise bigint check (cost_paise >= 0),
    barcode text,
    options jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'active' check (status in ('active','draft','archived')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
create unique index product_variants_tenant_sku_unique on public.product_variants (tenant_id, sku) where deleted_at is null;
create index product_variants_product_idx on public.product_variants (product_id) where deleted_at is null;
create index product_variants_tenant_status_idx on public.product_variants (tenant_id, status) where deleted_at is null;
alter table public.product_variants enable row level security;
drop policy if exists product_variants_tenant_select on public.product_variants;
create policy product_variants_tenant_select on public.product_variants for select using (tenant_id = auth.uid() and deleted_at is null);
drop policy if exists product_variants_tenant_insert on public.product_variants;
create policy product_variants_tenant_insert on public.product_variants for insert with check (tenant_id = auth.uid());
drop policy if exists product_variants_tenant_update on public.product_variants;
create policy product_variants_tenant_update on public.product_variants for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
drop policy if exists product_variants_tenant_delete on public.product_variants;
create policy product_variants_tenant_delete on public.product_variants for delete using (tenant_id = auth.uid());
drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at before update on public.product_variants for each row execute function public.set_updated_at();

create table public.inventory_levels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    variant_id uuid NOT NULL references public.product_variants(id) on delete cascade,
    location_key text NOT NULL DEFAULT 'default',
    on_hand int NOT NULL DEFAULT 0 check (on_hand >= 0),
    reserved int NOT NULL DEFAULT 0 check (reserved >= 0),
    reorder_threshold int NOT NULL DEFAULT 0 check (reorder_threshold >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
create unique index inventory_levels_variant_location_unique on public.inventory_levels (variant_id, location_key) where deleted_at is null;
create index inventory_levels_tenant_idx on public.inventory_levels (tenant_id) where deleted_at is null;
alter table public.inventory_levels enable row level security;
drop policy if exists inventory_levels_tenant_select on public.inventory_levels;
create policy inventory_levels_tenant_select on public.inventory_levels for select using (tenant_id = auth.uid() and deleted_at is null);
drop policy if not exists inventory_levels_tenant_insert on public.inventory_levels;
create policy inventory_levels_tenant_insert on public.inventory_levels for insert with check (tenant_id = auth.uid());
drop policy if exists inventory_levels_tenant_update on public.inventory_levels;
create policy inventory_levels_tenant_update on public.inventory_levels for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
drop policy if exists inventory_levels_tenant_delete on public.inventory_levels;
create policy inventory_levels_tenant_delete on public.inventory_levels for delete using (tenant_id = auth.uid());
drop trigger if exists inventory_levels_set_updated_at on public.inventory_levels;
create trigger inventory_levels_set_updated_at before update on public.inventory_levels for each row execute function public.set_updated_at();

create table public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    full_name text NOT NULL,
    email text,
    phone text,
    city text,
    address text,
    notes text,
    tags text[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
create index customers_tenant_phone_idx on public.customers (tenant_id, phone) where deleted_at is null;
create index customers_tenant_email_idx on public.customers (tenant_id, email) where deleted_at is null;
alter table public.customers enable row level security;
drop policy if exists customers_tenant_select on public.customers;
create policy customers_tenant_select on public.customers for select using (tenant_id = auth.uid() and deleted_at is null);
drop policy if exists customers_tenant_insert on public.customers;
create policy customers_tenant_insert on public.customers for insert with check (tenant_id = auth.uid());
drop policy if exists customers_tenant_update on public.customers;
create policy customers_tenant_update on public.customers for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
drop policy if exists customers_tenant_delete on public.customers;
create policy customers_tenant_delete on public.customers for delete using (tenant_id = auth.uid());
drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();

create table public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    customer_id uuid references public.customers(id) on delete set null,
    order_number text NOT NULL DEFAULT ('ORD-' || to_char(now(),'YYYYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8))),
    customer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending' check (status in ('pending','confirmed','packed','shipped','delivered','cancelled','returned')),
    subtotal_paise bigint NOT NULL DEFAULT 0 check (subtotal_paise >= 0),
    shipping_paise bigint NOT NULL DEFAULT 0 check (shipping_paise >= 0),
    discount_paise bigint NOT NULL DEFAULT 0 check (discount_paise >= 0),
    total_paise bigint NOT NULL DEFAULT 0 check (total_paise >= 0),
    currency text NOT NULL DEFAULT 'PKR',
    placed_at timestamptz NOT NULL DEFAULT now(),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
create unique index orders_tenant_number_unique on public.orders (tenant_id, order_number) where deleted_at is null;
create index orders_tenant_status_idx on public.orders (tenant_id, status) where deleted_at is null;
create index orders_tenant_placed_at_idx on public.orders (tenant_id, placed_at desc) where deleted_at is null;
alter table public.orders enable row level security;
drop policy if exists orders_tenant_select on public.orders;
create policy orders_tenant_select on public.orders for select using (tenant_id = auth.uid() and deleted_at is null);
drop policy if exists orders_tenant_insert on public.orders;
create policy orders_tenant_insert on public.orders for insert with check (tenant_id = auth.uid());
drop policy if exists orders_tenant_update on public.orders;
create policy orders_tenant_update on public.orders for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
drop policy if exists orders_tenant_delete on public.orders;
create policy orders_tenant_delete on public.orders for delete using (tenant_id = auth.uid());
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

create table public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL references public.orders(id) on delete cascade,
    variant_id uuid references public.product_variants(id) on delete restrict,
    product_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    quantity int NOT NULL check (quantity > 0),
    unit_price_paise bigint NOT NULL check (unit_price_paise >= 0),
    line_total_paise bigint NOT NULL check (line_total_paise >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
create index order_items_order_idx on public.order_items (order_id) where deleted_at is null;
create index order_items_tenant_variant_idx on public.order_items (tenant_id, variant_id) where deleted_at is null;
alter table public.order_items enable row level security;
drop policy if exists order_items_tenant_select on public.order_items;
create policy order_items_tenant_select on public.order_items for select using (tenant_id = auth.uid() and deleted_at is null);
drop policy if exists order_items_tenant_insert on public.order_items;
create policy order_items_tenant_insert on public.order_items for insert with check (tenant_id = auth.uid());
drop policy if exists order_items_tenant_update on public.order_items;
create policy order_items_tenant_update on public.order_items for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
drop policy if exists order_items_tenant_delete on public.order_items;
create policy order_items_tenant_delete on public.order_items for delete using (tenant_id = auth.uid());
drop trigger if exists order_items_set_updated_at on public.order_items;
create trigger order_items_set_updated_at before update on public.order_items for each row execute function public.set_updated_at();

create or replace function public.soft_delete_commerce_row(p_table text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tenant uuid := auth.uid();
    v_sql text;
begin
    if v_tenant is null then
        raise exception 'authentication required';
    end if;
    if p_table not in ('products','product_variants','inventory_levels','customers','orders','order_items') then
        raise exception 'table % is not allowed', p_table;
    end if;
    v_sql := format('update public.%I set deleted_at = now(), updated_at = now() where id = $1 and tenant_id = $2 and deleted_at is null', p_table);
    execute v_sql using p_id, v_tenant;
    if not found then
        raise exception 'row not found or already deleted';
    end if;
end;
$$;
grant execute on function public.soft_delete_commerce_row(text, uuid) to authenticated;

create or replace function public.decrement_inventory(p_variant_id uuid, p_location_key text default 'default', p_quantity int default 1)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tenant uuid := auth.uid();
    v_new_on_hand int;
begin
    if v_tenant is null then
        raise exception 'authentication required';
    end if;
    if p_quantity is null or p_quantity <= 0 then
        raise exception 'quantity must be > 0';
    end if;
    update public.inventory_levels il set quantity_on_hand = il.quantity_on_hand - p_quantity, updated_at = now() where il.variant_id = p_variant_id and il.location_key = p_location_key and il.tenant_id = v_tenant and il.on_hand >= p_quantity returning il.quantity_on_hand into v_new_on_hand;
    if not found then
        raise exception 'insufficient inventory or row not found';
    end if;
    return v_new_on_hand;
end;
$$;
grant execute on function public.decrement_inventory(uuid, text, int) to authenticated;

create or replace function public.increment_inventory(p_variant_id uuid, p_location_key text default 'default', p_quantity int default 1)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tenant uuid := auth.uid();
    v_new_on_hand int;
begin
    if v_tenant is null then
        raise exception 'authentication required';
    end if;
    if p_quantity is null or p_quantity <= 0 then
        raise exception 'quantity must be > 0';
    end if;
    insert into public.inventory_levels(tenant_id, variant_id, location_key, on_hand) values (v_tenant, p_variant_id, p_location_key, 0) on conflict (variant_id, location_key) do nothing;
    update public.inventory_levels il set quantity_on_hand = il.quantity_on_hand + p_quantity, updated_at = now() where il.variant_id = p_variant_id and il.location_key = p_location_key and il.tenant_id = v_tenant returning il.quantity_on_hand into v_new_on_hand;
    if not found then
        raise exception 'inventory row not found';
    end if;
    return v_new_on_hand;
end;
$$;
grant execute on function public.increment_inventory(uuid, text, int) to authenticated;

create or replace function public.create_order_with_items(p_customer_id uuid, p_items jsonb, p_shipping_paise bigint default 0, p_discount_paise bigint default 0, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tenant uuid := auth.uid();
    v_order_id uuid;
    v_subtotal bigint := 0;
    v_total bigint := 0;
    v_item jsonb;
    v_variant_id uuid;
    v_qty int;
    v_unit_price bigint;
    v_line_total bigint;
    v_snapshot jsonb;
begin
    if v_tenant is null then
        raise exception 'authentication required';
    end if;
    if p_customer_id is not null then
        if not exists (select 1 from public.customers where id = p_customer_id and tenant_id = v_tenant and deleted_at is null) then
            raise exception 'customer not found';
        end if;
    end if;
    for v_item in select * from jsonb_array_elements(p_items) loop
        v_variant_id := (v_item->>'variant_id')::uuid;
        v_qty := (v_item->>'quantity')::int;
        if v_variant_id is null or v_qty is null or v_qty <= 0 then
            raise exception 'invalid item in p_items';
        end if;
        select price_paise, jsonb_build_object('sku', sku, 'title', title, 'options', options) into v_unit_price, v_snapshot from public.product_variants where id = v_variant_id and tenant_id = v_tenant and deleted_at is null for update;
        if not found then
            raise exception 'variant not found';
        end if;
        v_line_total := v_unit_price * v_qty;
        v_subtotal := v_subtotal + v_line_total;
    end loop;
    v_total := v_subtotal + coalesce(p_shipping_paise, 0) - coalesce(p_discount_paise, 0);
    if v_total < 0 then
        raise exception 'total cannot be negative';
    end if;
    insert into public.orders (tenant_id, customer_id, customer_snapshot, status, subtotal_paise, shipping_paise, discount_paise, total_paise, currency, placed_at, notes) values (v_tenant, p_customer_id, coalesce((select jsonb_build_object('full_name', full_name, 'phone', phone, 'address', address) from public.customers where id = p_customer_id and tenant_id = v_tenant), '{}'::jsonb), 'confirmed', v_subtotal, coalesce(p_shipping_paise, 0), coalesce(p_discount_paise, 0), v_total, 'PKR', now(), p_notes) returning id into v_order_id;
    for v_item in select * from jsonb_array_elements(p_items) loop
        v_variant_id := (v_item->>'variant_id')::uuid;
        v_qty := (v_item->>'quantity')::int;
        select price_paise, jsonb_build_object('sku', sku, 'title', title, 'options', options) into v_unit_price, v_snapshot from public.product_variants where id = v_variant_id and tenant_id = v_tenant and deleted_at is null for update;
        v_line_total := v_unit_price * v_qty;
        insert into public.order_items (tenant_id, order_id, variant_id, product_snapshot, quantity, unit_price_paise, line_total_paise) values (v_tenant, v_order_id, v_variant_id, v_snapshot, v_qty, v_unit_price, v_line_total);
        perform public.decrement_inventory(v_variant_id, 'default', v_qty);
    end loop;
    return v_order_id;
end;
$$;
grant execute on function public.create_order_with_items(uuid, jsonb, bigint, bigint, text) to authenticated;

create or replace function public.prevent_locked_order_changes()
returns trigger
language plpgsql
as $$
declare
    v_status text;
begin
    if tg_op in ('UPDATE','DELETE') then
        select status into v_status from public.orders where id = old.order_id;
        if v_status not in ('pending','cancelled') then
            raise exception 'order items are immutable once the order is confirmed';
        end if;
    end if;
    if tg_op = 'UPDATE' then
        return new;
    else
        return old;
    end if;
end;
$$;
drop trigger if exists order_items_prevent_locked_changes on public.order_items;
create trigger order_items_prevent_locked_changes before update or delete on public.order_items for each row execute function public.prevent_locked_order_changes();

create or replace function public.prevent_locked_order_update()
returns trigger
language plpgsql
as $$
begin
    if old.status in ('delivered','returned') then
        if new.notes is distinct from old.notes or new.deleted_at is distinct from old.deleted_at then
            return new;
        end if;
        raise exception 'orders are immutable once delivered or returned';
    end if;
    return new;
end;
$$;
drop trigger if exists orders_prevent_locked_update on public.orders;
create trigger orders_prevent_locked_update before update on public.orders for each row execute function public.prevent_locked_order_update();

grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_variants to authenticated;
grant select, insert, update, delete on public.inventory_levels to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;