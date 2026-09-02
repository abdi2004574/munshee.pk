import { supabase } from "@/lib/supabase";
import type { Tenant, TenantUpdate, AppSettings, AppSettingsUpdate } from "@/lib/types";

export async function getTenant(): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from("tenants" as never)
    .select("*")
    .eq("id", (await supabase.auth.getUser()).data.user!.id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Tenant) ?? null;
}

export async function updateTenant(data: TenantUpdate): Promise<Tenant> {
  const { data: updated, error } = await supabase
    .from("tenants" as never)
    .update(data as never)
    .eq("id", (await supabase.auth.getUser()).data.user!.id)
    .select("*")
    .single();
  if (error) throw error;
  return updated as unknown as Tenant;
}

export async function getAppSettings(): Promise<AppSettings> {
  const userId = (await supabase.auth.getUser()).data.user!.id;
  const { data, error } = await supabase
    .from("app_settings" as never)
    .select("*")
    .eq("tenant_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as unknown as AppSettings;
  return {
    tenant_id: userId,
    locale: "en-PK",
    currency: "PKR",
    timezone: "Asia/Karachi",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function updateAppSettings(
  data: AppSettingsUpdate,
): Promise<AppSettings> {
  const userId = (await supabase.auth.getUser()).data.user!.id;
  const { data: updated, error } = await supabase
    .from("app_settings" as never)
    .update({ ...data, updated_at: new Date().toISOString() } as never)
    .eq("tenant_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return updated as unknown as AppSettings;
}
