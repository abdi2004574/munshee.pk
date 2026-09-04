import { useEffect } from "react";
import { useParams } from "react-router";
import { usePublicProfile, useIncrementViews } from "../hooks";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonCard } from "@/components/Skeleton";

const CATEGORY_LABELS: Record<string, string> = {
  product: "Products",
  pricing: "Pricing",
  policy: "Policies",
  contact: "Contact",
  hours: "Business Hours",
  location: "Location",
  service_area: "Service Area",
  brand_voice: "Brand Voice",
};

const CATEGORY_VARIANTS: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  product: "info",
  pricing: "success",
  policy: "default",
  contact: "info",
  hours: "warning",
  location: "default",
  service_area: "default",
  brand_voice: "danger",
};

export function PublicProfilePage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { data: facts = [], isLoading, error } = usePublicProfile(tenantId);
  const incrementViews = useIncrementViews();

  useEffect(() => {
    if (tenantId) {
      incrementViews.mutate(tenantId);
    }
  }, [tenantId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-3xl space-y-4 px-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <p className="text-danger">Failed to load profile.</p>
        </Card>
      </div>
    );
  }

  if (facts.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <EmptyState
            title="No public profile yet"
            description="This business hasn't published any public facts."
          />
        </Card>
      </div>
    );
  }

  const grouped = facts.reduce<Record<string, typeof facts>>((acc, fact) => {
    const cat = fact.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(fact);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-surface-muted">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-ink">Business Profile</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Public information verified by the business owner.
          </p>
        </div>

        <div className="space-y-6">
          {Object.entries(grouped).map(([category, categoryFacts]) => (
            <Card key={category} className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <Badge variant={CATEGORY_VARIANTS[category] ?? "default"}>
                  {CATEGORY_LABELS[category] ?? category}
                </Badge>
                <span className="text-xs text-ink-muted">
                  {categoryFacts.length} fact{categoryFacts.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-3">
                {categoryFacts.map((fact, index) => (
                  <div
                    key={`${fact.category}-${fact.label}-${index}`}
                    className="flex flex-col gap-1 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0"
                  >
                    <dt className="text-sm font-medium text-ink">{fact.label}</dt>
                    <dd className="text-sm text-ink-muted">{fact.value}</dd>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

