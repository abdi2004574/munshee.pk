import { supabase } from "@/lib/supabase";
import type { Plan } from "@/lib/plans-service";

export async function getPublicPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from("plans" as never)
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name),
    price_pkr: Number(row.price_pkr),
    actions_monthly: Number(row.actions_monthly),
    max_businesses: Number(row.max_businesses),
    features: (row.features as Record<string, boolean>) ?? {},
    sort_order: Number(row.sort_order),
  }));
}
