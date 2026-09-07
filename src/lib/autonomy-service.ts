import { supabase } from "@/lib/supabase";

export async function isKilled(businessId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_kill_switch_active", {
    p_business_id: businessId,
  } as never);
  if (error) throw error;
  return data as boolean;
}

export async function getLevel(
  businessId: string,
  actionType: string,
): Promise<number> {
  const { data, error } = await supabase.rpc(
    "get_autonomy_level_with_kill_switch",
    {
      p_business_id: businessId,
      p_action_type: actionType,
    } as never,
  );
  if (error) throw error;
  return data as number;
}

export async function setLevel(
  businessId: string,
  actionType: string,
  level: number,
  autoApprove: boolean = false,
): Promise<void> {
  const { error } = await supabase
    .from("autonomy_settings" as never)
    .upsert({
      business_id: businessId,
      action_type: actionType,
      level,
      auto_approve: autoApprove,
    } as never, {
      onConflict: "business_id,action_type",
    });
  if (error) throw error;
}
