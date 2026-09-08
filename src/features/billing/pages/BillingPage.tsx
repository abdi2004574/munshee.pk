import { useState } from "react";
import { useBillingPlans, useBillingPlanData, useCreatePendingSubscription, useActionPacks, usePurchaseActionPack, useCreditLedger } from "../hooks";
import { useActiveBusiness } from "@/hooks/usePlan";
import { useToast } from "@/components/Toast";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";
import { PlanGatingError } from "@/components/PlanGatingError";
import { t } from "@/i18n";
import { getPaymentAccount } from "../api";
import type { Plan } from "@/lib/plans-service";

function formatPrice(pkr: number): string {
  return `Rs ${pkr.toLocaleString("en-PK")}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "�";
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

const FEATURE_LABELS: Record<string, string> = {
  watermark: "Munshee.pk watermark",
  rescans: "Rescan frequency",
  digest: "Digest type",
  voice_items: "Voice items",
  udhaar_drafts: "Udhaar drafts",
  invoices: "Invoices",
  ads_drafts: "Ad drafts",
  clients: "Clients",
  roi_ledger: "ROI ledger",
  reporting_export: "Reporting & export",
  tax_ready: "Tax ready",
  udhaar_full: "Full udhaar",
};

export function BillingPage() {
  const toast = useToast();
  const { businessId } = useActiveBusiness();
  const plansQuery = useBillingPlans();
  const planDataQuery = useBillingPlanData(businessId || undefined);
  const createPending = useCreatePendingSubscription();
  const packsQuery = useActionPacks();
  const purchasePack = usePurchaseActionPack();
  const ledgerQuery = useCreditLedger(businessId || undefined);

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [gatingError, setGatingError] = useState<{
    mode: "actions_exhausted" | "feature_cap";
    feature?: string;
  } | null>(null);

  const plans = plansQuery.data ?? [];
  const planData = planDataQuery.data;
  const currentPlan = planData?.plan ?? plans.find((p) => p.id === "free") ?? null;
  const actionsLeft = planData?.actionsLeft ?? 0;
  const actionsMonthly = currentPlan?.actions_monthly ?? 150;
  const periodEnd = planData?.subscription?.period_end ?? null;
  const isAdminGranted = planData?.subscription?.admin_granted ?? false;
  const isPending = planData?.subscription?.status === "pending_payment";
  const packs = packsQuery.data ?? [];

  const paymentAccount = getPaymentAccount();

  function openPayment(plan: Plan) {
    if (plan.id === "free") {
      toast.info("You are on the free plan");
      return;
    }
    setSelectedPlan(plan);
    setReferenceNumber("");
    setConfirmation(false);
  }

  async function submitPayment() {
    if (!selectedPlan || !businessId) return;
    if (!referenceNumber.trim()) {
      toast.error("Please enter a reference number");
      return;
    }
    try {
      await createPending.mutateAsync({
        businessId,
        planId: selectedPlan.id,
        referenceNumber: referenceNumber.trim(),
      });
      setConfirmation(true);
      toast.success(t("billing.pending_activation"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function buyPack(packSku: string) {
    if (!businessId) return;
    try {
      await purchasePack.mutateAsync({ businessId, packSku });
      toast.success(t("billing.pack_activated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const featureCaps = currentPlan?.features ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{t("billing.title")}</h1>
      </div>

      {isPending && !confirmation && (
        <Card className="border-warning/20 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <Badge variant="warning">{t("billing.pending_confirmation")}</Badge>
          </div>
        </Card>
      )}

      {/* 402 Gating Error Modal */}
      {gatingError && (
        <PlanGatingError
          open={!!gatingError}
          onClose={() => setGatingError(null)}
          mode={gatingError.mode}
          feature={gatingError.feature}
          actionsLeft={actionsLeft}
          actionsMonthly={actionsMonthly}
        />
      )}

      {/* Current Plan Card */}
      {currentPlan && (
        <Card id="action-packs" className="p-6">
          <p className="text-sm font-medium text-ink-muted">{t("billing.current_plan")}</p>
          <div className="mt-2 flex items-baseline gap-3">
            <h2 className="text-2xl font-bold text-ink">{currentPlan.name}</h2>
            {isAdminGranted && <Badge variant="success">{t("billing.admin_granted")}</Badge>}
            {isPending && <Badge variant="warning">Pending</Badge>}
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">{t("billing.actions_left")}</span>
              <span className="font-medium text-ink">
                {actionsLeft} / {actionsMonthly}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-brand-500 transition-all"
                style={{
                  width: `${Math.min(100, (actionsLeft / actionsMonthly) * 100)}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">{t("billing.renewal_date")}</span>
              <span className="text-ink">{formatDate(periodEnd)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Feature Caps */}
      {Object.keys(featureCaps).length > 0 && (
        <Card id="action-packs" className="p-6">
          <h3 className="text-lg font-medium text-ink">{t("billing.feature_caps")}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(featureCaps).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <span className="text-sm text-ink-muted">{FEATURE_LABELS[key] || key}</span>
                <Badge variant={(value === true || value === "unlimited") ? "success" : (typeof value === "number" && value > 0) ? "info" : "warning"}>
                  {value === true ? "Included" : (value === "unlimited" ? "Unlimited" : String(value))}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Action Packs */}
      {packs.length > 0 && (
        <Card id="action-packs" className="p-6">
          <h3 className="text-lg font-medium text-ink">{t("billing.action_packs")}</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Need more Actions? Buy a pack and an admin will activate it.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {packs.map((pack) => (
              <Card key={pack.sku} className="flex flex-col p-5">
                <h4 className="text-base font-semibold text-ink">{pack.sku.replace("pack_", "Pack ")}</h4>
                <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
                  {formatPrice(pack.price_pkr)}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {pack.actions} Actions / {pack.validity_days} {t("billing.validity_days")}
                </p>
                <div className="mt-auto pt-4">
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() => buyPack(pack.sku)}
                    disabled={purchasePack.isPending}
                  >
                    {purchasePack.isPending ? t("common.loading") : t("billing.pack_purchase")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* Credit Ledger */}
      {ledgerQuery.data && ledgerQuery.data.length > 0 && (
        <Card id="action-packs" className="p-6">
          <h3 className="text-lg font-medium text-ink">{t("billing.credit_ledger")}</h3>
          <div className="mt-4 space-y-2">
            {ledgerQuery.data.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0">
                <div>
                  <span className="font-medium text-ink">{entry.reason}</span>
                  <span className="ml-2 text-xs text-ink-muted">{formatDate(entry.created_at)}</span>
                </div>
                <div className="text-right">
                  <span className={entry.delta > 0 ? "text-green-600" : "text-red-600"}>
                    {entry.delta > 0 ? "+" : ""}{entry.delta}
                  </span>
                  {entry.expires_at && (
                    <span className="ml-2 text-xs text-ink-muted">
                      {t("billing.expires")} {formatDate(entry.expires_at)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Plan Switcher */}
      <div id="plan-switcher">
        <h2 className="text-lg font-medium text-ink">{t("billing.plan_switcher")}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col p-5">
              <h3 className="text-base font-semibold text-ink">{plan.name}</h3>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
                {formatPrice(plan.price_pkr)}
                <span className="text-sm font-normal text-ink-muted">{t("billing.per_month")}</span>
              </p>
              <p className="mt-1 text-xs text-ink-muted">{plan.actions_monthly} actions/month</p>
              <div className="mt-auto pt-4">
                <Button
                  className="w-full"
                  variant={plan.id === currentPlan?.id ? "secondary" : "primary"}
                  onClick={() => openPayment(plan)}
                  disabled={plan.id === currentPlan?.id || plan.id === "free"}
                >
                  {plan.id === "free" ? "Free" : plan.id === currentPlan?.id ? "Current" : t("billing.select_plan")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Payment Modal */}
      {selectedPlan && !confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-ink">
              {t("billing.manual_pay")} � {selectedPlan.name}
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              {formatPrice(selectedPlan.price_pkr)} / month
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-ink">{t("billing.payment_account")}</p>
                <Card className="mt-1 bg-gray-50 p-3">
                  <p className="text-sm text-ink">{paymentAccount}</p>
                </Card>
              </div>
              <Input
                label={t("billing.reference_number")}
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. TXN123456"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelectedPlan(null)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={submitPayment} disabled={createPending.isPending}>
                {createPending.isPending ? t("common.loading") : t("billing.submit")}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Confirmation Screen */}
      {selectedPlan && confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6 text-center">
            <Badge variant="success" className="mx-auto">?</Badge>
            <h2 className="mt-4 text-lg font-semibold text-ink">
              {t("billing.pending_activation")}
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              {t("billing.pending_confirmation")}
            </p>
            <div className="mt-6 flex justify-center">
              <Button onClick={() => { setSelectedPlan(null); setConfirmation(false); }}>
                {t("common.close")}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
