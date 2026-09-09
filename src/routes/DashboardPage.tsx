import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Profile, AppSettings } from "@/lib/types";
import { Card } from "@/components/Card";
import { SkeletonCard } from "@/components/Skeleton";
import { t } from "@/i18n";

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

  const isLoading =
    profileQuery.isLoading ||
    settingsQuery.isLoading ||
    totalProducts.isLoading ||
    totalOrders.isLoading ||
    totalCustomers.isLoading ||
    pendingOrders.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{t("dashboard.greeting")}{name}</h1>
        <p className="text-sm text-ink-muted">
          {t("dashboard.ready")}{currency}.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <p className="text-sm text-ink-muted">{t("dashboard.total_products")}</p>
            <p className="text-3xl font-semibold text-ink">
              {totalProducts.data ?? 0}
            </p>
            <p className="text-xs text-ink-muted">{t("dashboard.active_catalog")}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-ink-muted">{t("dashboard.total_orders")}</p>
            <p className="text-3xl font-semibold text-ink">
              {totalOrders.data ?? 0}
            </p>
            <p className="text-xs text-ink-muted">{t("dashboard.all_time")}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-ink-muted">{t("dashboard.total_customers")}</p>
            <p className="text-3xl font-semibold text-ink">
              {totalCustomers.data ?? 0}
            </p>
            <p className="text-xs text-ink-muted">{t("dashboard.active_contacts")}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-ink-muted">{t("dashboard.pending_orders")}</p>
            <p className="text-3xl font-semibold text-ink">
              {pendingOrders.data ?? 0}
            </p>
            <p className="text-xs text-ink-muted">{t("dashboard.awaiting_fulfilment")}</p>
          </Card>
        </div>
      )}

      <Card className="p-6">
        <p className="text-sm text-ink-muted">
          {t("dashboard.phase_note")}
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">
          {t("dashboard.share_profile")}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t("dashboard.share_hint")}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/profile/${profileQuery.data?.tenant_id}`;
              void navigator.clipboard.writeText(url);
              alert("Copied profile link");
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary shadow-sm hover:bg-primary-hover"
          >
            {t("dashboard.copy_link")}
          </button>
          <a
            href={`/profile/${profileQuery.data?.tenant_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            {t("dashboard.view_profile")}
          </a>
        </div>
      </Card>
    </div>
  );
}

