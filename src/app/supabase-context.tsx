import { createContext, useContext, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types";

export type SupabaseContextValue = SupabaseClient<Database>;

const SupabaseContext = createContext<SupabaseContextValue>(supabase);

export function useSupabase(): SupabaseContextValue {
  return useContext(SupabaseContext);
}

export function SupabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}
