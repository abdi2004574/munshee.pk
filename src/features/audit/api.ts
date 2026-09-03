import { supabase } from "@/lib/supabase";

export interface AuditLogInsert {
  tenant_id: string;
  fact_id: string | null;
  actor: string;
  action: "confirm" | "edit" | "delete" | "import";
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
}

export async function createAuditLog(
  data: AuditLogInsert,
): Promise<void> {
  const { error } = await supabase
    .from("audit_log" as never)
    .insert(data as never);
  if (error) throw error;
}
