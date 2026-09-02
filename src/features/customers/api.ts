import { supabase } from "@/lib/supabase";
import type { Customer, CustomerInsert, CustomerUpdate } from "@/lib/types";

export interface ListCustomersFilters {
  search?: string;
}

export interface ListCustomersPagination {
  from: number;
  to: number;
}

async function getTenantId() {
  const { data } = await supabase.auth.getSession();
  const tenantId = data.session?.user.id;
  if (!tenantId) throw new Error("Not authenticated");
  return tenantId;
}

export async function listCustomers(
  filters: ListCustomersFilters = {},
  pagination: ListCustomersPagination = { from: 0, to: 24 },
): Promise<Customer[]> {
  const tenantId = await getTenantId();
  let query = supabase
    .from("customers" as never)
    .select("*")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(pagination.from, pagination.to);

  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Customer[];
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const tenantId = await getTenantId();
  const { data, error } = await supabase
    .from("customers" as never)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as unknown as Customer;
}

export async function createCustomer(data: CustomerInsert): Promise<Customer> {
  const { data: created, error } = await supabase
    .from("customers" as never)
    .insert(data as never)
    .select("*")
    .single();
  if (error) throw error;
  return created as unknown as Customer;
}

export async function updateCustomer(id: string, data: CustomerUpdate): Promise<Customer> {
  const tenantId = await getTenantId();
  const { data: updated, error } = await supabase
    .from("customers" as never)
    .update(data as never)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return updated as unknown as Customer;
}

export async function softDeleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_commerce_row" as never, {
    p_table: "customers",
    p_id: id,
  } as never);
  if (error) throw error;
}
