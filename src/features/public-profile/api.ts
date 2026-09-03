import { supabase } from "@/lib/supabase";

export interface PublicProfileFact {
  tenant_id: string;
  category: string;
  label: string;
  value: string;
}

export async function getPublicProfile(tenantId: string): Promise<PublicProfileFact[]> {
  const { data, error } = await supabase
    .from("public_profile" as never)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("category", { ascending: true })
    .order("label", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PublicProfileFact[];
}

export async function incrementViews(tenantId: string): Promise<void> {
  const { error } = await supabase.rpc("increment_views", {
    p_tenant_id: tenantId,
  } as never);
  if (error) throw error;
}
