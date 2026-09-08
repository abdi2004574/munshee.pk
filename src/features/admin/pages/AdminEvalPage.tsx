import { useMemo } from "react";
import { useEvalWeekly } from "../hooks-eval";
import { useAdminMode } from "@/hooks/usePlan";
import { Card } from "@/components/Card";
import { t } from "@/i18n";

const SOURCE_LABELS: Record<string, string> = {
  text: "Text",
  vision: "Vision",
  scrape: "Scrape",
  import: "Import",
  csv: "CSV",
  manual: "Manual",
  auto_extract: "Auto Extract",
  ask_munshee: "Ask Munshee",
};

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatConfidence(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function AdminEvalPage() {
  const adminMode = useAdminMode();
  const { data: rows = [], isLoading } = useEvalWeekly();

  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.tenant_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return map;
  }, [rows]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Weekly Eval</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Last 14 days · source_type accuracy
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-muted">
          No evaluation data yet.
        </Card>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([tenantId, tenantRows]) => (
            <Card key={tenantId} className="p-6">
              <div className="mb-4">
                <span className="text-xs font-medium uppercase tracking-wide text-brand-600">
                  Business
                </span>
                <p className="mt-1 font-mono text-sm text-ink">{tenantId}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="pb-2 font-medium text-ink-muted">
                        Source type
                      </th>
                      <th className="pb-2 font-medium text-ink-muted text-right tabular-nums">
                        Total
                      </th>
                      <th className="pb-2 font-medium text-ink-muted text-right tabular-nums">
                        Confirmed no edit
                      </th>
                      <th className="pb-2 font-medium text-ink-muted text-right tabular-nums">
                        Avg confidence
                      </th>
                      <th className="pb-2 font-medium text-ink-muted text-right tabular-nums">
                        Actions used
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tenantRows.map((row) => (
                      <tr key={`${tenantId}-${row.source_type}`}>
                        <td className="py-3 text-ink">
                          {SOURCE_LABELS[row.source_type] ?? row.source_type}
                        </td>
                        <td className="py-3 text-right tabular-nums text-ink">
                          {row.total}
                        </td>
                        <td className="py-3 text-right tabular-nums">
                          <span
                            className={
                              row.pct_confirmed_without_edit >= 80
                                ? "text-brand-600"
                                : row.pct_confirmed_without_edit >= 50
                                  ? "text-amber-600"
                                  : "text-danger"
                            }
                          >
                            {formatPct(row.pct_confirmed_without_edit)}
                          </span>
                        </td>
                        <td className="py-3 text-right tabular-nums text-ink">
                          {formatConfidence(row.avg_confidence)}
                        </td>
                        <td className="py-3 text-right tabular-nums text-ink-muted">
                          {row.actions_used}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}