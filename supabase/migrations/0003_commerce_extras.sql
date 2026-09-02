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
    insert into public.inventory_levels(tenant_id, variant_id, location_key, quantity_on_hand) values (v_tenant, p_variant_id, p_location_key, 0) on conflict (variant_id, location_key) do nothing;
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