import { supabase } from "@/lib/supabase";

export async function approveImportItem(queueId: string, targetRowId: string): Promise<void> {
  const { error } = await supabase.rpc("approve_import_item" as never, {
    p_queue_id: queueId,
    p_target_row_id: targetRowId,
  } as never);
  if (error) throw error;
}

export async function rejectImportItem(queueId: string): Promise<void> {
  const { error } = await supabase.rpc("reject_import_item" as never, {
    p_queue_id: queueId,
  } as never);
  if (error) throw error;
}
