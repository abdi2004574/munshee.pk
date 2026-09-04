import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/app/queryClient";
import { SupabaseProvider } from "@/app/supabase-context";
import { ToastProvider } from "@/components/Toast";
import { ToastContainer } from "@/components/ToastContainer";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <ToastProvider>
          {children}
          <ToastContainer />
        </ToastProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}
