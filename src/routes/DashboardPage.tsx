import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Profile, AppSettings } from "@/lib/types";
import { Card } from "@/components/Card";

export function DashboardPage() {
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .single<Profile>();
      if (error) throw error;
      return data;
    },
  });

  const settingsQuery = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .single<AppSettings>();
      if (error) throw error;
      return data;
    },
  });

  const name = profileQuery.data?.full_name ?? "there";
  const currency = settingsQuery.data?.currency ?? "PKR";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">
          Hello, {name}
        </h1>
        <p className="text-sm text-ink-muted">
          Your dashboard is ready. Currency: {currency}.
        </p>
      </div>

      <Card className="p-6">
        <p className="text-sm text-ink-muted">
          Phase 1.1 foundation is in place. Catalog, orders, inventory, and
          automation features land in later phases.
        </p>
      </Card>
    </div>
  );
}
