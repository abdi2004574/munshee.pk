import { supabase } from "@/lib/supabase";
import type { PendingPayment } from "@/lib/plans-service";

export async function getPendingPayments(): Promise<PendingPayment[]> {
  const { data, error } = await supabase
    .from("subscriptions" as never)
    .select("*, plans:plan_id(id, name, price_pkr)")
    .eq("status", "pending_payment") as unknown as { data: Record<string, unknown>[] | null; error: unknown };
  if (error) throw error;
  return (data ?? []).map((row) => {
    const plan = (row.plans as Record<string, unknown>) ?? {};
    return {
      id: String(row.id ?? ""),
      business_id: String(row.business_id ?? ""),
      plan_id: String(row.plan_id ?? ""),
      plan_name: String(plan.name ?? ""),
      created_at: String(row.created_at ?? ""),
      period_end: row.period_end ? String(row.period_end) : null,
      subscription_status: "pending_payment" as const,
    };
  });
}

export async function activateSubscription(subscriptionId: string, planId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_activate_subscription", {
    p_subscription_id: subscriptionId,
    p_plan_id: planId,
  } as never);
  if (error) throw error;
}
