import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types";

export interface RescanInput {
  url?: string;
}

export interface RescanOutput {
  facts: unknown[];
  delta: { added: number; changed: number; removed: number; unchanged: number };
  skipped: boolean;
}

export async function triggerRescan(
  _businessId: string,
  input: RescanInput = {},
): Promise<RescanOutput> {
  const { data, error } = await supabase.functions.invoke("re-scan-business", {
    body: input,
  });
  if (error) throw error;
  return data as RescanOutput;
}

export async function getRescanSchedule(
  businessId: string,
): Promise<Database["public"]["Tables"]["rescan_schedules"]["Row"] | null> {
  const { data, error } = await supabase
    .from("rescan_schedules" as never)
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw error;
  return (data as Database["public"]["Tables"]["rescan_schedules"]["Row"] | null) ?? null;
}

export async function upsertRescanSchedule(
  businessId: string,
  cadence: string,
): Promise<void> {
  const { error } = await supabase.rpc("upsert_rescan_schedule", {
    p_business_id: businessId,
    p_cadence: cadence,
  } as never);
  if (error) throw error;
}

export async function listPendingReviewFacts(
  businessId: string,
): Promise<Database["public"]["Tables"]["business_facts"]["Row"][]> {
  const { data, error } = await supabase
    .from("business_facts" as never)
    .select("*")
    .eq("tenant_id", businessId)
    .eq("status", "needs_review")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Database["public"]["Tables"]["business_facts"]["Row"][];
}
