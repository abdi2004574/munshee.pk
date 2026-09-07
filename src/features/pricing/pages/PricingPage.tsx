import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Icon } from "@/components/Icon";
import { getPublicPlans } from "../api";
import { t } from "@/i18n";

function formatPrice(pricePkr: number): string {
  return `Rs ${pricePkr.toLocaleString("en-PK")}`;
}

export function PricingPage() {
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["public-plans"],
    queryFn: getPublicPlans,
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-brand-50/30">
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-ink sm:text-4xl">
            {t("pricing.title")}
          </h1>
          <p className="mt-3 text-base text-ink-muted sm:text-lg">
            {t("pricing.subtitle")}
          </p>
        </div>

        {isLoading ? (
          <div className="mt-12 text-center text-ink-muted">Loading…</div>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const isPopular = plan.id === "starter";
              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col rounded-lg border bg-white p-6 ${
                    isPopular ? "border-2 border-brand-400" : "border border-gray-200"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge variant="warning" className="bg-amber-100 text-amber-800">
                        {t("pricing.popular")}
                      </Badge>
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-semibold text-ink">
                      {plan.name}
                    </h2>
                    <p className="mt-2 text-3xl font-bold tabular-nums text-ink">
                      {formatPrice(plan.price_pkr)}
                      <span className="text-sm font-normal text-ink-muted">/mo</span>
                    </p>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-ink-muted flex-1">
                    <li className="flex items-start gap-2">
                      <Icon name="check" size={16} className="mt-0.5 text-brand-500" />
                      <span>{plan.actions_monthly} {t("pricing.actions.free").split(" ")[1] || "actions/month"}</span>
                    </li>
                    {plan.features.ask_munshee && (
                      <li className="flex items-start gap-2">
                        <Icon name="check" size={16} className="mt-0.5 text-brand-500" />
                        <span>{t("pricing.feature.ask_munshee")}</span>
                      </li>
                    )}
                    {plan.features.wa_export_analysis && (
                      <li className="flex items-start gap-2">
                        <Icon name="check" size={16} className="mt-0.5 text-brand-500" />
                        <span>{t("pricing.feature.wa_export")}</span>
                      </li>
                    )}
                    {plan.features.voice_digest && (
                      <li className="flex items-start gap-2">
                        <Icon name="check" size={16} className="mt-0.5 text-brand-500" />
                        <span>{t("pricing.feature.voice_digest")}</span>
                      </li>
                    )}
                    {plan.features.client_switcher && (
                      <li className="flex items-start gap-2">
                        <Icon name="check" size={16} className="mt-0.5 text-brand-500" />
                        <span>{t("pricing.feature.client_switcher")}</span>
                      </li>
                    )}
                    {plan.features.reporting_export && (
                      <li className="flex items-start gap-2">
                        <Icon name="check" size={16} className="mt-0.5 text-brand-500" />
                        <span>{t("pricing.feature.reporting")}</span>
                      </li>
                    )}
                    {plan.features.directory_eligible && (
                      <li className="flex items-start gap-2">
                        <Icon name="check" size={16} className="mt-0.5 text-brand-500" />
                        <span>{t("pricing.feature.directory")}</span>
                      </li>
                    )}
                    {plan.features.watermark && (
                      <li className="flex items-start gap-2">
                        <Icon name="check" size={16} className="mt-0.5 text-amber-500" />
                        <span className="text-ink-muted">{t("pricing.feature.watermark")}</span>
                      </li>
                    )}
                    <li className="flex items-start gap-2">
                      <Icon name="check" size={16} className="mt-0.5 text-brand-500" />
                      <span>
                        {plan.max_businesses === 1
                          ? `1 ${t("pricing.businesses.free").includes("business") ? "business" : "business"}`
                          : `${t("pricing.businesses.business").replace("Up to ", "Up to ")}`}
                      </span>
                    </li>
                  </ul>
                  <div className="mt-8">
                    <Link to="/apps/billing" className="block">
                      <Button className="w-full" variant={isPopular ? "primary" : "primary"}>
                        {plan.price_pkr === 0 ? t("pricing.free.cta") : t("pricing.paid.cta")}
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-12 text-center" id="expert-info">
          <p className="text-sm text-ink-muted">
            {t("pricing.footer.expert")}
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link to="/dashboard" className="text-sm text-brand-600 hover:text-brand-700 hover:underline">
            {t("common.back")}
          </Link>
        </div>
      </div>
    </div>
  );
}
