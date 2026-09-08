import { supabase } from "@/lib/supabase";

export interface EvalWeeklyRow {
  tenant_id: string;
  source_type: string;
  total: number;
  pct_confirmed_without_edit: number;
  avg_confidence: number;
  actions_used: number;
}

export async function getEvalWeekly(): Promise<EvalWeeklyRow[]> {
  const { data, error } = await supabase
    .from("eval_weekly" as never)
    .select("*")
    .order("tenant_id", { ascending: true })
    .order("source_type", { ascending: true });

  if (error) throw error;
  return (data as EvalWeeklyRow[] | null) ?? [];
}
