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
  subscription_status: string | null;
  admin_granted: boolean;
  actions_remaining: number;
  last_grant_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CurrentPlan {
  plan: Plan | null;
  subscription: Subscription | null;
  actionsLeft: number;
}

export interface ConsumeActionResult {
  ok: boolean;
  actionsLeft: number;
  code?: string;
  feature?: string;
}

export interface ManagedBusiness {
  business_id: string;
  tenant_id: string;
  display_name: string;
  slug: string;
  managed_by: string | null;
  actions_left: number | null;
  subscription_status: string | null;
}

export interface PendingPayment {
  id: string;
  business_id: string;
  plan_id: string;
  plan_name: string;
  created_at: string;
  period_end: string | null;
  subscription_status: string | null;
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

export interface PurchasePackResult {
  subscriptionId: string;
  pack: ActionPack;
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getCurrentPlan(businessId?: string): Promise<CurrentPlan> {
  const bizId = businessId ?? (await getCurrentUserId());
  if (!bizId) {
    return { plan: null, subscription: null, actionsLeft: 0 };
  }
  const { data, error } = await supabase.rpc("get_current_plan", {
    p_business_id: bizId,
  } as never);
  if (error) throw error;
  if (!data) {
    return { plan: null, subscription: null, actionsLeft: 0 };
  }
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
  const subscription: Subscription | null = row.subscription_status
    ? {
        id: "",
        business_id: bizId,
        plan_id: plan.id,
        status: (row.subscription_status as Subscription["status"]) ?? "trial",
        period_start: row.period_start ? String(row.period_start) : null,
        period_end: row.period_end ? String(row.period_end) : null,
        admin_granted: Boolean(row.admin_granted),
        actions_remaining: Number(row.actions_left ?? 0),
        last_grant_at: null,
        subscription_status: String(row.subscription_status),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    : null;
  return {
    plan,
    subscription,
    actionsLeft: Number(row.actions_left ?? 0),
  };
}

export async function consumeAction(
  businessId: string,
  reason: string,
  _model?: string,
): Promise<ConsumeActionResult> {
  const { data, error } = await supabase.rpc("consume_action", {
    p_business_id: businessId,
    p_action_type: reason,
  } as never);
  if (error) throw error;
  const result = data as { ok: boolean; actions_left: number; code?: string; feature?: string } | null;
  if (!result) {
    return { ok: false, actionsLeft: 0 };
  }
  return {
    ok: result.ok,
    actionsLeft: result.actions_left,
    code: result.code,
    feature: result.feature,
  };
}

export async function ensureMonthlyGrant(businessId: string): Promise<number> {
  const { data, error } = await supabase.rpc("ensure_monthly_grant_by_business", {
    p_business_id: businessId,
  } as never);
  if (error) throw error;
  return Number(data ?? 0);
}

export async function isAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;

  const envEmails = import.meta.env.VITE_ALLOWED_ADMIN_EMAILS;
  if (envEmails) {
    const emails = envEmails
      .split(",")
      .map((e: string) => e.trim().toLowerCase())
      .filter(Boolean);
    if (emails.includes(user.email.toLowerCase())) return true;
  }

  try {
    const { data, error } = await supabase.rpc("get_admin_emails" as never);
    if (error) return false;
    const emails = (data as { email: string }[] | null) ?? [];
    return emails.some((e) => e.email.toLowerCase() === user.email!.toLowerCase());
  } catch {
    return false;
  }
}

export async function getPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from("plans" as never)
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as Plan[] | null) ?? [];
}

export async function createSubscription(
  businessId: string,
  planId: string,
): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions" as never)
    .insert({
      business_id: businessId,
      plan_id: planId,
      status: "pending_payment",
      period_start: new Date().toISOString(),
      period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      admin_granted: false,
      actions_remaining: 0,
      last_grant_at: new Date().toISOString(),
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as Record<string, unknown>;
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    plan_id: String(row.plan_id),
    status: (row.status as Subscription["status"]) ?? "pending_payment",
    period_start: row.period_start ? String(row.period_start) : null,
    period_end: row.period_end ? String(row.period_end) : null,
    admin_granted: Boolean(row.admin_granted),
    actions_remaining: Number(row.actions_remaining ?? 0),
    last_grant_at: row.last_grant_at ? String(row.last_grant_at) : null,
    subscription_status: row.status ? String(row.status) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getFeatureFlags(
  businessId: string,
): Promise<{
  plan_id: string;
  plan_name: string;
  features: Record<string, boolean | number | string>;
  actions_left: number;
  subscription_status: string;
} | null> {
  const { data, error } = await supabase.rpc("get_feature_flags", {
    p_business_id: businessId,
  } as never);
  if (error) return null;
  if (!data) return null;
  const row = data as unknown as Record<string, unknown>;
  return {
    plan_id: String(row.plan_id ?? ""),
    plan_name: String(row.plan_name ?? ""),
    features: (row.features as Record<string, boolean>) ?? {},
    actions_left: Number(row.actions_left ?? 0),
    subscription_status: String(row.subscription_status ?? "trial"),
  };
}

export async function getManagedBusinesses(): Promise<ManagedBusiness[]> {
  const { data, error } = await supabase.rpc("get_managed_businesses" as never);
  if (error) throw error;
  return ((data as unknown as Record<string, unknown>[] | null) ?? []).map((row: Record<string, unknown>) => ({
    business_id: String(row.business_id ?? ""),
    tenant_id: String(row.tenant_id ?? ""),
    display_name: String(row.display_name ?? ""),
    slug: String(row.slug ?? ""),
    managed_by: row.managed_by ? String(row.managed_by) : null,
    actions_left: row.actions_left != null ? Number(row.actions_left) : null,
    subscription_status: row.subscription_status
      ? String(row.subscription_status)
      : null,
  }));
}

export async function createClientBusiness(
  businessName: string,
  phone?: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("create_client_business", {
    p_business_name: businessName,
    p_phone: phone ?? null,
    p_expert_profile_id: await getCurrentUserId(),
    p_display_name: businessName,
  } as never);
  if (error) throw error;
  if (!data) return null;
  return String(data);
}

export async function getPendingPayments(): Promise<PendingPayment[]> {
  const { data, error } = await supabase
    .from("subscriptions" as never)
    .select(`*, plans!inner(id, name, price_pkr)`)
    .eq("status", "pending_payment") as never;
  if (error) throw error;
  return ((data as unknown as Record<string, unknown>[] | null) ?? []).map((row: Record<string, unknown>) => {
    const plan = (row.plans as Record<string, unknown>) ?? {};
    return {
      id: String(row.id ?? ""),
      business_id: String(row.business_id ?? ""),
      plan_id: String(row.plan_id ?? ""),
      plan_name: String(plan.name ?? ""),
      created_at: String(row.created_at ?? ""),
      period_end: row.period_end ? String(row.period_end) : null,
      subscription_status: row.status ? String(row.status) : null,
    };
  });
}

export function getActiveBusiness(): string {
  const stored = localStorage.getItem("munshee-active-business");
  if (stored) return stored;
  return "";
}

export function setActiveBusiness(businessId: string): void {
  localStorage.setItem("munshee-active-business", businessId);
}

// ============================================================================
// Action packs
// ============================================================================

export async function getActionPacks(): Promise<ActionPack[]> {
  const { data, error } = await supabase
    .from("action_packs" as never)
    .select("*")
    .order("sku", { ascending: true });
  if (error) throw error;
  return (data as ActionPack[] | null) ?? [];
}

export async function purchaseActionPack(
  businessId: string,
  packSku: string,
): Promise<PurchasePackResult | null> {
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

// ============================================================================
// Credit ledger
// ============================================================================

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

export async function activatePendingPack(
  subscriptionId: string,
  creditAmount: number,
  expiresAt: string,
): Promise<void> {
  const { error } = await supabase.rpc("activate_action_pack", {
    p_subscription_id: subscriptionId,
    p_credit_amount: creditAmount,
    p_expires_at: expiresAt,
  } as never);
  if (error) throw error;
}

