import { supabase } from "@/lib/supabase";
import type { InventoryLevel } from "@/lib/types";

export interface InventoryRow extends InventoryLevel {
  product_variants?: {
    sku: string;
    name: string;
    product_id: string;
  } | null;
}

export async function listInventory(variantId?: string): Promise<InventoryRow[]> {
  let query = supabase
    .from("inventory_levels" as never)
    .select("*, product_variants!inventory_levels_variant_id_fkey(sku, name, product_id)")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (variantId) {
    query = query.eq("variant_id", variantId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as InventoryRow[];
}

export type AdjustType = "increment" | "decrement";

export interface AdjustInventoryInput {
  variantId: string;
  quantity: number;
  location: string;
  type: AdjustType;
}

export async function adjustInventory({
  variantId,
  quantity,
  location,
  type,
}: AdjustInventoryInput): Promise<number> {
  const fn = type === "increment" ? "increment_inventory" : "decrement_inventory";
  const { data, error } = await supabase.rpc(fn as never, {
    p_variant_id: variantId,
    p_location_key: location,
    p_quantity: quantity,
  } as never);
  if (error) throw error;
  return Number(data ?? 0);
}
