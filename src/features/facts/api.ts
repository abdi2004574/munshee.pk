import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types";

export interface BusinessFactInsert {
  tenant_id: string;
  category: string;
  label: string;
  value: string;
  confidence: number | null;
  source_type: string;
  source_ref: string | null;
  linked_table: string | null;
  linked_row_id: string | null;
  status: string;
}

export async function createBusinessFact(
  data: BusinessFactInsert,
): Promise<Database["public"]["Tables"]["business_facts"]["Row"]> {
  const { data: created, error } = await supabase
    .from("business_facts" as never)
    .insert(data as never)
    .select("*")
    .single();
  if (error) throw error;
  return created as Database["public"]["Tables"]["business_facts"]["Row"];
}

export async function createBusinessFactsBatch(
  facts: BusinessFactInsert[],
): Promise<Database["public"]["Tables"]["business_facts"]["Row"][]> {
  const { data: created, error } = await supabase
    .from("business_facts" as never)
    .insert(facts as never)
    .select("*");
  if (error) throw error;
  return (created ?? []) as Database["public"]["Tables"]["business_facts"]["Row"][];
}

export async function listBusinessFacts(filters: {
  category?: string;
  status?: string;
  linked_table?: string;
  linked_row_id?: string;
} = {}): Promise<Database["public"]["Tables"]["business_facts"]["Row"][]> {
  let query = supabase
    .from("business_facts" as never)
    .select("*")
    .is("deleted_at", null);

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.linked_table) query = query.eq("linked_table", filters.linked_table);
  if (filters.linked_row_id) query = query.eq("linked_row_id", filters.linked_row_id);

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Database["public"]["Tables"]["business_facts"]["Row"][];
}

export async function updateBusinessFact(
  id: string,
  updates: Partial<BusinessFactInsert>,
): Promise<Database["public"]["Tables"]["business_facts"]["Row"]> {
  const { data: updated, error } = await supabase
    .from("business_facts" as never)
    .update(updates as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return updated as Database["public"]["Tables"]["business_facts"]["Row"];
}