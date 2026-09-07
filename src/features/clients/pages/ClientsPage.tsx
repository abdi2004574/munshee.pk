import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useManagedBusinesses, useCreateClientBusiness } from "../hooks";
import { usePlan, useActiveBusiness } from "@/hooks/usePlan";
import { useToast } from "@/components/Toast";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { t } from "@/i18n";
import { supabase } from "@/lib/supabase";

export function ClientsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: planData } = usePlan();
  const { data: managedBusinesses = [], isLoading } = useManagedBusinesses();
  const createClient = useCreateClientBusiness();
  const { businessId, setBusinessId } = useActiveBusiness();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileRole, setProfileRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles" as never).select("role").maybeSingle();
      setProfileRole((data as { role?: string } | null)?.role ?? null);
    })();
  }, []);

  if (profileRole && !["expert", "both"].includes(profileRole)) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-lg font-semibold text-danger">403</h2>
          <p className="mt-2 text-sm text-ink-muted">{t("errors.unauthorized")}</p>
        </Card>
      </div>
    );
  }

  const features = planData?.plan?.features ?? null;
  if (features && !features.client_switcher) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-lg font-semibold text-warning">Business Plan Required</h2>
          <p className="mt-2 text-sm text-ink-muted">{t("clients.limit_reached")}</p>
          <Button className="mt-4" onClick={() => navigate("/apps/billing")}>
            {t("common.go_to_billing")}
          </Button>
        </Card>
      </div>
    );
  }

  function handleSwitch(tenantId: string) {
    setBusinessId(tenantId);
    toast.success(t("clients.switch_success"));
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error(t("clients.name_required"));
      return;
    }
    try {
      await createClient.mutateAsync({ name: name.trim(), phone: phone.trim() || undefined });
      toast.success("Client created");
      setShowModal(false);
      setName("");
      setPhone("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      if (msg.includes("limit") || msg.includes("6")) {
        toast.error(t("clients.limit_reached"));
      } else {
        toast.error(msg);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">{t("clients.title")}</h1>
        <Button onClick={() => setShowModal(true)}>
          {t("clients.add_client")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">{t("common.loading")}</p>
      ) : managedBusinesses.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            title={t("clients.empty")}
            description={t("clients.add_client")}
            action={
              <Button onClick={() => setShowModal(true)}>
                {t("clients.add_client")}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {managedBusinesses.map((b) => {
            const isActive = b.tenant_id === businessId;
            const actions = b.actions_left ?? 0;
            const pct = planData?.plan?.actions_monthly
              ? Math.min(100, (actions / planData.plan.actions_monthly) * 100)
              : 0;
            return (
              <Card key={b.business_id} className={`p-4 ${isActive ? "border-brand-400 border-2" : ""}`}>
                <div className="flex items-start justify-between">
                  <h3 className="text-base font-semibold text-ink">{b.display_name || "Client"}</h3>
                  {isActive && <Badge variant="success">Active</Badge>}
                </div>
                <div className="mt-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-brand-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {actions} {t("clients.actions_left")}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant={b.subscription_status === "active" ? "success" : "default"}>
                    {b.subscription_status ?? "trial"}
                  </Badge>
                  <Button
                    variant="secondary"
                    onClick={() => handleSwitch(b.tenant_id)}
                    disabled={isActive}
                  >
                    {t("clients.switch_context")}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-ink">{t("clients.add_client")}</h2>
            <div className="mt-4 space-y-4">
              <Input
                label="Business name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Store"
              />
              <Input
                label={t("clients.phone_optional")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 300 1234567"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleCreate} disabled={createClient.isPending}>
                {createClient.isPending ? t("common.loading") : t("clients.create")}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
