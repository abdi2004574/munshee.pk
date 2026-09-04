import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Money } from "@/components/Money";
import { useCreditBalance, useClaimFreeCredits } from "../hooks";
import { useSubscriptionPlans } from "../hooks";
import { useCreditLedger } from "../hooks";
import { useInitiatePayment } from "../hooks";

function ActionTypeLabel({ type }: { type: string }) {
  const map: Record<string, { label: string; variant: "default" | "info" | "success" | "warning" }> = {
    text_extraction: { label: "Text Extraction", variant: "default" },
    vision_extraction: { label: "Vision Extraction", variant: "info" },
    ask_munshee_query: { label: "Ask Munshee", variant: "success" },
    website_scrape: { label: "Website Scrape", variant: "warning" },
    plan_topup: { label: "Plan Top-up", variant: "success" },
    plan_subscription: { label: "Subscription", variant: "info" },
  };
  const info = map[type] ?? { label: type, variant: "default" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

export function BillingPage() {
  const balanceQuery = useCreditBalance();
  const plansQuery = useSubscriptionPlans();
  const ledgerQuery = useCreditLedger();
  const claimMutation = useClaimFreeCredits();
  const paymentMutation = useInitiatePayment();

  const [claimedFree, setClaimedFree] = useState(false);

  const ledger = ledgerQuery.data ?? [];
  const hasClaimedFree = ledger.some((entry) => entry.reference_id === "free_initial");
  const canClaimFree = balanceQuery.data === 0 && !hasClaimedFree && !claimedFree;

  async function onClaimFree() {
    try {
      await claimMutation.mutateAsync();
      setClaimedFree(true);
    } catch {
      // error handled via mutation state
    }
  }

  async function onSubscribe(provider: "jazzcash" | "easypaisa", planId: string) {
    try {
      const result = await paymentMutation.mutateAsync({ provider, planId });
      window.location.href = result.redirect_url;
    } catch {
      // error handled via mutation state
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Billing & Plans</h1>
        <p className="text-sm text-ink-muted">
          Manage your credits and subscription.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <p className="text-sm font-medium text-ink-muted">Credit Balance</p>
          <p className="mt-1 text-3xl font-bold text-ink">
            {balanceQuery.isLoading ? "…" : balanceQuery.data ?? 0}
          </p>
          {canClaimFree && (
            <div className="mt-4">
              <Button onClick={onClaimFree} disabled={claimMutation.isPending}>
                {claimMutation.isPending ? "Claiming…" : "Claim free credits"}
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <p className="text-sm font-medium text-ink-muted">Payment Integration</p>
          <p className="mt-2 text-xs text-ink-muted">
            Payment integration is in sandbox mode — requires JazzCash/Easypaisa merchant sandbox credentials to test.
          </p>
          <div className="mt-4 flex gap-2">
            <Badge variant="info">JazzCash (scaffold)</Badge>
            <Badge variant="info">Easypaisa (scaffold)</Badge>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-medium text-ink">Subscription Plans</h2>
        <p className="text-sm text-ink-muted">
          Choose a plan to add credits to your account.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plansQuery.isLoading ? (
            <Card className="p-6">
              <p className="text-sm text-ink-muted">Loading plans…</p>
            </Card>
          ) : (
            (plansQuery.data ?? []).map((plan) => (
              <Card key={plan.id} className="flex flex-col p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-ink">{plan.name}</h3>
                  <Badge variant="default">{plan.monthly_credits} credits</Badge>
                </div>
                <p className="mt-2 text-2xl font-bold text-ink">
                  <Money value={plan.price_pkr} currency="PKR" />
                </p>
                <p className="mt-1 text-xs text-ink-muted">{plan.description}</p>
                <ul className="mt-4 space-y-1.5 text-sm text-ink-muted">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-0.5 text-brand-600">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-4">
                  <Button
                    className="w-full"
                    onClick={() => onSubscribe("jazzcash", plan.id)}
                    disabled={paymentMutation.isPending}
                  >
                    {paymentMutation.isPending ? "Redirecting…" : "Subscribe"}
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-ink">Credit Ledger</h2>
        <p className="text-sm text-ink-muted">Recent credit transactions.</p>
        <Card className="mt-4 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted">Action</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-ink-muted">Credits</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-ink-muted">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-ink-muted">
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                ledger.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 text-ink-muted">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <ActionTypeLabel type={entry.action_type} />
                    </td>
                    <td className="px-4 py-2 text-right text-ink">
                      {entry.credits_used > 0 ? `-${entry.credits_used}` : entry.credits_used === 0 ? "0" : `+${Math.abs(entry.credits_used)}`}
                    </td>
                    <td className="px-4 py-2 text-right text-ink">{entry.balance_after}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}