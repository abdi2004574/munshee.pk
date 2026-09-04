import { supabase } from "@/lib/supabase";

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_credits: number;
  price_pkr: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

export interface CreditLedgerEntry {
  id: string;
  tenant_id: string;
  action_type: string;
  credits_used: number;
  balance_after: number;
  reference_id: string | null;
  created_at: string;
}

export async function getCurrentCreditBalance(): Promise<number> {
  const { data, error } = await supabase
    .from("tenants" as never)
    .select("credit_balance")
    .single();
  if (error) throw error;
  return Number((data as { credit_balance: number } | null)?.credit_balance ?? 0);
}

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans" as never)
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name),
    description: row.description as string | null,
    monthly_credits: Number(row.monthly_credits),
    price_pkr: Number(row.price_pkr),
    features: (row.features as string[]) ?? [],
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order),
  }));
}

export async function getCreditLedger(): Promise<CreditLedgerEntry[]> {
  const { data, error } = await supabase
    .from("credit_ledger" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    action_type: String(row.action_type),
    credits_used: Number(row.credits_used),
    balance_after: Number(row.balance_after),
    reference_id: row.reference_id as string | null,
    created_at: String(row.created_at),
  }));
}

export async function claimFreeCredits(): Promise<number> {
  const { data, error } = await supabase.rpc("claim_free_credits", {
    p_credits: 5,
  } as never);
  if (error) throw error;
  return Number(data ?? 0);
}

export async function initiatePayment(
  provider: "jazzcash" | "easypaisa",
  planId: string
): Promise<{ redirect_url: string; transaction_id: string }> {
  const functionName =
    provider === "jazzcash"
      ? "payment-jazzcash"
      : "payment-easypaisa";

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { plan_id: planId },
    method: "POST",
  });

  if (error) throw error;
  return data as { redirect_url: string; transaction_id: string };
}