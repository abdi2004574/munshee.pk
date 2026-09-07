import { supabase } from "@/lib/supabase";

export interface Plan {
  id: string;
  name: string;
  price_pkr: number;
  actions_monthly: number;
  max_businesses: number;
  features: Record<string, boolean | number | string>;
  sort_order: number;
}

export interface Subscription {
  id: string;
  business_id: string;
  plan_id: string;
  status: "active" | "pending_payment" | "expired" | "trial";
  period_start: string | null;
  period_end: string | null;
  admin_granted: boolean;
  actions_remaining: number;
  last_grant_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionPack {
  sku: string;
  actions: number;
  price_pkr: number;
  validity_days: number;
  created_at: string;
}

export interface CreditLedgerEntry {
  id: string;
  business_id: string;
  delta: number;
  reason: string;
  balance_after: number;
  expires_at: string | null;
  created_at: string;
}

export async function getPlans(): Promise<Plan[]> {
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

export async function getCurrentSubscription(businessId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions" as never)
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as Record<string, unknown>;
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    plan_id: String(row.plan_id),
    status: (row.status as Subscription["status"]) ?? "trial",
    period_start: row.period_start ? String(row.period_start) : null,
    period_end: row.period_end ? String(row.period_end) : null,
    admin_granted: Boolean(row.admin_granted),
    actions_remaining: Number(row.actions_remaining ?? 0),
    last_grant_at: row.last_grant_at ? String(row.last_grant_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function createPendingSubscription(businessId: string, planId: string, _referenceNumber: string): Promise<Subscription> {
  const { data, error } = await supabase
    .from("subscriptions" as never)
    .upsert(
      {
        business_id: businessId,
        plan_id: planId,
        status: "pending_payment",
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        admin_granted: false,
        actions_remaining: 0,
        last_grant_at: null,
      } as never,
      { onConflict: "business_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  const row = data as unknown as Record<string, unknown>;
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    plan_id: String(row.plan_id),
    status: "pending_payment",
    period_start: String(row.period_start),
    period_end: String(row.period_end),
    admin_granted: false,
    actions_remaining: 0,
    last_grant_at: null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getCurrentPlanData(businessId: string): Promise<{ plan: Plan; subscription: Subscription | null; actionsLeft: number } | null> {
  try {
    const { data, error } = await supabase.rpc("get_current_plan", { p_business_id: businessId } as never);
    if (error) return null;
    if (!data) return null;
    const row = data as unknown as Record<string, unknown>;
    const plan: Plan = {
      id: String(row.plan_id ?? ""),
      name: String(row.plan_name ?? ""),
      price_pkr: Number(row.price_pkr ?? 0),
      actions_monthly: Number(row.actions_monthly ?? 0),
      max_businesses: Number(row.max_businesses ?? 0),
      features: (row.features as Record<string, boolean>) ?? {},
      sort_order: 0,
    };
    const sub: Subscription | null = row.subscription_status
      ? {
          id: "",
          business_id: businessId,
          plan_id: plan.id,
          status: (row.subscription_status as Subscription["status"]) ?? "trial",
          period_start: row.period_start ? String(row.period_start) : null,
          period_end: row.period_end ? String(row.period_end) : null,
          admin_granted: Boolean(row.admin_granted),
          actions_remaining: Number(row.actions_left ?? 0),
          last_grant_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : null;
    return { plan, subscription: sub, actionsLeft: Number(row.actions_left ?? 0) };
  } catch {
    return null;
  }
}

export async function getActionPacks(): Promise<ActionPack[]> {
  const { data, error } = await supabase
    .from("action_packs" as never)
    .select("*")
    .order("sku", { ascending: true });
  if (error) throw error;
  return (data as ActionPack[] | null) ?? [];
}

export async function purchaseActionPack(businessId: string, packSku: string): Promise<{ subscriptionId: string; pack: ActionPack } | null> {
  const { data, error } = await supabase.rpc("purchase_action_pack", {
    p_business_id: businessId,
    p_pack_sku: packSku,
  } as never);
  if (error) throw error;
  const packs = await getActionPacks();
  const pack = packs.find((p) => p.sku === packSku);
  if (!pack) return null;
  return {
    subscriptionId: String(data ?? ""),
    pack,
  };
}

export async function getCreditLedger(businessId: string): Promise<CreditLedgerEntry[]> {
  const { data, error } = await supabase.rpc("get_credit_ledger", {
    p_business_id: businessId,
    p_limit: 50,
  } as never);
  if (error) throw error;
  return ((data as unknown as Record<string, unknown>[] | null) ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id ?? ""),
    business_id: String(row.business_id ?? ""),
    delta: Number(row.delta ?? 0),
    reason: String(row.reason ?? ""),
    balance_after: Number(row.balance_after ?? 0),
    expires_at: row.expires_at ? String(row.expires_at) : null,
    created_at: String(row.created_at ?? ""),
  }));
}

export function getPaymentAccount(): string {
  return import.meta.env.VITE_PAYMENT_ACCOUNT ?? "Not configured";
}
