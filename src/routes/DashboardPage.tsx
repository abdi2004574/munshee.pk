import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Profile, AppSettings } from "@/lib/types";
import { Card } from "@/components/Card";

function useCountQuery(
  key: string,
  table: string,
  filter?: (q: any) => any
) {
  return useQuery({
    queryKey: [key],
    queryFn: async () => {
      let q = supabase.from(table).select("id", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count, error } = await q;
      if (error) throw error;
      return (count ?? 0) as number;
    },
  });
}

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

  const totalProducts = useCountQuery("count_products", "products", (q) =>
    q.is("deleted_at", null)
  );
  const totalOrders = useCountQuery("count_orders", "orders", (q) =>
    q.is("deleted_at", null)
  );
  const totalCustomers = useCountQuery("count_customers", "customers", (q) =>
    q.is("deleted_at", null)
  );
  const pendingOrders = useCountQuery("count_orders_pending", "orders", (q) =>
    q.is("deleted_at", null).eq("status", "pending")
  );

  const name = profileQuery.data?.full_name ?? "there";
  const currency = settingsQuery.data?.currency ?? "PKR";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Hello, {name}</h1>
        <p className="text-sm text-ink-muted">
          Your dashboard is ready. Currency: {currency}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-sm text-ink-muted">Total Products</p>
          <p className="text-3xl font-semibold text-ink">
            {totalProducts.data ?? 0}
          </p>
          <p className="text-xs text-ink-muted">Active catalog items</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-ink-muted">Total Orders</p>
          <p className="text-3xl font-semibold text-ink">
            {totalOrders.data ?? 0}
          </p>
          <p className="text-xs text-ink-muted">All time</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-ink-muted">Total Customers</p>
          <p className="text-3xl font-semibold text-ink">
            {totalCustomers.data ?? 0}
          </p>
          <p className="text-xs text-ink-muted">Active contacts</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-ink-muted">Pending Orders</p>
          <p className="text-3xl font-semibold text-ink">
            {pendingOrders.data ?? 0}
          </p>
          <p className="text-xs text-ink-muted">Awaiting fulfilment</p>
        </Card>
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
