import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { getEnv } from "@/lib/env";

const env = getEnv();

export const supabase = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

