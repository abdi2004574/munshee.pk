import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data;
    },
    staleTime: 60_000,
  });
}
