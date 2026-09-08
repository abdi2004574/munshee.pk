import { useState } from "react";
import { usePendingPayments, useActivateSubscription } from "../hooks";
import { useAdminMode } from "@/hooks/usePlan";
import { activatePendingPack } from "@/lib/plans-service";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";
import { t } from "@/i18n";
import { useToast } from "@/components/Toast";

function truncateId(id: string, len = 8): string {
  return id.length > len ? `${id.slice(0, len)}…` : id;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-PK", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}


export function AdminPage() {
  const toast = useToast();
  const adminMode = useAdminMode();
  const { data: payments = [], isLoading } = usePendingPayments();
  const activate = useActivateSubscription();

  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  if (adminMode.isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-ink-muted">
        {t("common.loading")}
      </div>
    );
  }

  if (!adminMode.data) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-lg font-semibold text-danger">403</h2>
          <p className="mt-2 text-sm text-ink-muted">{t("errors.unauthorized")}</p>
        </Card>
      </div>
    );
  }

  async function handleActivatePack(subscriptionId: string) {
    if (!creditAmount.trim()) {
      toast.error("Enter credit amount");
      return;
    }
    if (!expiresAt) {
      toast.error("Enter expiry date");
      return;
    }
    try {
      await activatePendingPack(
        subscriptionId,
        Number(creditAmount),
        new Date(expiresAt).toISOString()
      );
      toast.success(t("admin.activate_success"));
      setActivatingId(null);
      setCreditAmount("");
      setExpiresAt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleActivatePlan(subscriptionId: string, planId: string) {
    try {
      await activate.mutateAsync({ subscriptionId, planId });
      toast.success(t("admin.activate_success"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{t("admin.title")}</h1>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">{t("admin.pending_payments")}</h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-ink-muted">{t("common.loading")}</p>
        ) : payments.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">{t("admin.no_pending")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-ink-muted">
                  <th className="pb-2 font-medium">{t("admin.subscription_id")}</th>
                  <th className="pb-2 font-medium">{t("admin.plan")}</th>
                  <th className="pb-2 font-medium">{t("admin.business_id")}</th>
                  <th className="pb-2 font-medium">{t("admin.status")}</th>
                  <th className="pb-2 font-medium">{t("admin.created_at")}</th>
                  <th className="pb-2 font-medium">Reference</th>
                  <th className="pb-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="py-3 font-mono text-xs">{truncateId(payment.id)}</td>
                    <td className="py-3">
                      <div className="font-medium">{payment.plan_name}</div>
                      <div className="text-xs text-ink-muted">{payment.plan_id}</div>
                    </td>
                    <td className="py-3 font-mono text-xs">{truncateId(payment.business_id)}</td>
                    <td className="py-3">
                      <Badge variant={payment.subscription_status === "pending_payment" ? "warning" : "success"}>
                        {payment.subscription_status ?? "unknown"}
                      </Badge>
                    </td>
                    <td className="py-3 text-ink-muted">{formatDate(payment.created_at)}</td>
                    <td className="py-3 font-mono text-xs text-ink-muted">
                      {payment.reference_number || "—"}
                    </td>
                    <td className="py-3">
                      {payment.plan_id.startsWith("pack_") ? (
                        activatingId === payment.id ? (
                          <div className="flex flex-col gap-2">
                            <Input
                              type="number"
                              placeholder="Credits"
                              value={creditAmount}
                              onChange={(e) => setCreditAmount(e.target.value)}
                              className="h-8 text-xs"
                              label="Credit amount"
                            />
                            <Input
                              type="date"
                              value={expiresAt}
                              onChange={(e) => setExpiresAt(e.target.value)}
                              className="h-8 text-xs"
                              label="Expiry date"
                            />
                            <div className="flex gap-1">
                              <Button
                                onClick={() => handleActivatePack(payment.id)}
                              >
                                {t("admin.activate")}
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => setActivatingId(null)}
                              >
                                {t("common.cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            onClick={() => setActivatingId(payment.id)}
                          >
                            {t("admin.activate")}
                          </Button>
                        )
                      ) : (
                        <Button
                          onClick={() => handleActivatePlan(payment.id, payment.plan_id)}
                          disabled={activate.isPending}
                        >
                          {activate.isPending ? t("common.loading") : t("admin.activate")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}





