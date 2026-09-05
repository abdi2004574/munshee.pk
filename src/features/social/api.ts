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
    let errMsg = "Failed to initiate social connect";

    const anyError = error as unknown as {
      data?: { error?: string };
      context?: { json?: () => Promise<{ error?: string }> };
      message?: string;
    };

    if (anyError.data?.error) {
      errMsg = anyError.data.error;
    } else if (anyError.context?.json) {
      try {
        const body = await anyError.context.json();
        if (body.error) errMsg = body.error;
      } catch {
        if (anyError.message) errMsg = anyError.message;
      }
    } else if (anyError.message) {
      errMsg = anyError.message;
    }

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
