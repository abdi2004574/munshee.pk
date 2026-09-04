import { supabase } from "@/lib/supabase";
import type { SocialConnection } from "@/lib/types";

export interface InitiateSocialConnectResult {
  auth_url: string;
}

export async function initiateSocialConnect(
  provider: "facebook" | "instagram",
): Promise<string> {
  const { data, error } = await supabase.functions.invoke<InitiateSocialConnectResult>(
    "social-connect",
    { body: { provider } },
  );

  if (error) {
    const errMsg =
      (error as unknown as { data?: { error?: string } })?.data?.error ??
      error.message ??
      "Failed to initiate social connect";
    throw new Error(errMsg);
  }

  if (!data?.auth_url) {
    throw new Error("auth_url not returned from social-connect");
  }
  return data.auth_url;
}

export async function listSocialConnections(): Promise<SocialConnection[]> {
  const { data, error } = await supabase
    .from("social_connections")
    .select("*")
    .is("deleted_at", null);
  if (error) throw error;
  return (data ?? []) as SocialConnection[];
}

export async function revokeSocialConnection(id: string): Promise<void> {
  const { error } = await supabase
    .from("social_connections" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw error;
}
