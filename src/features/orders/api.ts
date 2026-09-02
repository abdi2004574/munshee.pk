import { supabase } from "@/lib/supabase";
import type { Order, OrderItem } from "@/lib/types";

export interface ListOrdersFilters {
  status?: string;
  customer_id?: string;
  placed_from?: string;
  placed_to?: string;
}

export interface ListOrdersPagination {
  from: number;
  to: number;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export interface CreateOrderItemInput {
  variant_id: string;
  quantity: number;
}

export interface CreateOrderWithItemsParams {
  customer_id: string;
  items: CreateOrderItemInput[];
  shipping_total: number;
  discount_total: number;
  notes: string;
}

async function getTenantId() {
  const { data } = await supabase.auth.getSession();
  const tenantId = data.session?.user.id;
  if (!tenantId) throw new Error("Not authenticated");
  return tenantId;
}

export async function listOrders(
  filters: ListOrdersFilters = {},
  pagination: ListOrdersPagination = { from: 0, to: 24 },
): Promise<Order[]> {
  const tenantId = await getTenantId();
  let query = supabase
    .from("orders" as never)
    .select("*")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("placed_at", { ascending: false })
    .range(pagination.from, pagination.to);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.customer_id) {
    query = query.eq("customer_id", filters.customer_id);
  }
  if (filters.placed_from) {
    query = query.gte("placed_at", filters.placed_from);
  }
  if (filters.placed_to) {
    query = query.lte("placed_at", filters.placed_to);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Order[];
}

export async function getOrder(id: string): Promise<OrderWithItems | null> {
  const tenantId = await getTenantId();
  const { data, error } = await supabase
    .from("orders" as never)
    .select("*, order_items!order_items_order_id_fkey(*)")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const raw = data as unknown as OrderWithItems;
  raw.order_items = (raw.order_items ?? []).filter((it) => it.deleted_at === null);
  return raw;
}

export async function getOrderItem(id: string): Promise<OrderItem | null> {
  const tenantId = await getTenantId();
  const { data, error } = await supabase
    .from("order_items" as never)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as unknown as OrderItem;
}

export async function createOrderWithItems(
  params: CreateOrderWithItemsParams,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "create_order_with_items" as never,
    {
      p_customer_id: params.customer_id,
      p_items: params.items as never,
      p_shipping_paise: params.shipping_total,
      p_discount_paise: params.discount_total,
      p_notes: params.notes,
    } as never,
  );
  if (error) throw error;
  return data as unknown as string;
}

export async function updateOrderStatus(id: string, status: string): Promise<Order> {
  const tenantId = await getTenantId();
  const { data, error } = await supabase
    .from("orders" as never)
    .update({ status } as never)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as Order;
}

export async function softDeleteOrder(id: string): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_commerce_row" as never, {
    p_table: "orders",
    p_id: id,
  } as never);
  if (error) throw error;
}
