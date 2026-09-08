import { useState } from "react";
import { Link } from "react-router";
import { usePendingReviewFacts } from "./hooks";

export function RescanBanner({ businessId }: { businessId: string }) {
  const { data: pendingFacts = [] } = usePendingReviewFacts(businessId);
  const [dismissed, setDismissed] = useState(false);

  if (pendingFacts.length === 0 || dismissed) {
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-2">
      <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-brand-800">
            {pendingFacts.length} cheezein badli hain — 1 minute review
          </span>
          <Link
            to="/apps/review"
            className="text-sm font-semibold text-brand-600 underline hover:text-brand-700"
          >
            Review now
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-brand-400 hover:text-brand-600"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
