import { supabase } from "@/lib/supabase";

export interface AskRequest {
  tenant_id: string;
  question: string;
}

export interface AskResponse {
  answer: string;
}

export async function invokeAskMunshee(
  tenantId: string,
  question: string,
): Promise<AskResponse> {
  const { data, error } = await supabase.functions.invoke<AskResponse>(
    "ask-munshee",
    { body: { tenant_id: tenantId, question } },
  );
  if (error) throw error;
  if (!data) throw new Error("No response from ask-munshee");
  return data;
}
