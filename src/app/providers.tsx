import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/app/queryClient";
import { SupabaseProvider } from "@/app/supabase-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>{children}</SupabaseProvider>
    </QueryClientProvider>
  );
}
