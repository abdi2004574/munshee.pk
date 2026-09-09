import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useBusinessFacts } from "@/features/facts/hooks";
import { useCreateAuditLog } from "@/features/audit/hooks";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { t } from "@/i18n";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types";

type BusinessFact = Database["public"]["Tables"]["business_facts"]["Row"];

const PAGE_SIZE = 25;

function statusVariant(
  status: string,
): "success" | "warning" | "danger" | "default" {
  if (status === "needs_review") return "warning";
  if (status === "confirmed") return "success";
  if (status === "rejected") return "danger";
  return "default";
}

export function ReviewQueuePage() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const createAuditLog = useCreateAuditLog();
  const toast = useToast();
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [batchWorking, setBatchWorking] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const category = params.get("category") ?? "";
  const status = params.get("status") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const filters = useMemo(
    () => ({
      category: category || undefined,
      status: status || undefined,
    }),
    [category, status],
  );

  const { data: facts = [], isLoading } = useBusinessFacts(filters);

  const totalItems = facts.length;
  const paginatedFacts = useMemo(
    () => facts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [facts, page],
  );

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      setParams(next);
    },
    [params, setParams],
  );

  const setPage = useCallback(
    (p: number) => {
      const next = new URLSearchParams(params);
      next.set("page", String(p));
      setParams(next);
    },
    [params, setParams],
  );

  async function applyFactStatus(
    fact: BusinessFact,
    newStatus: "confirmed" | "rejected",
  ): Promise<void> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error("Not authenticated");
    const tenantId = authData.user.id;

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("business_facts" as never)
      .update({ status: newStatus, updated_at: now } as never)
      .eq("id", fact.id);
    if (updateError) throw updateError;

    await createAuditLog.mutateAsync({
      tenant_id: tenantId,
      fact_id: fact.id,
      actor: tenantId,
      action: newStatus === "confirmed" ? "confirm" : "delete",
      old_value: { status: "needs_review" },
      new_value: { status: newStatus },
    });

    qc.invalidateQueries({ queryKey: ["business-facts"] });
  }

  async function handleApprove(fact: BusinessFact) {
    setWorkingId(fact.id);
    try {
      await applyFactStatus(fact, "confirmed");
      toast.success(t("reviews.confirmed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("reviews.confirm_failed"));
    } finally {
      setWorkingId(null);
    }
  }

  async function handleReject(fact: BusinessFact) {
    setWorkingId(fact.id);
    try {
      await applyFactStatus(fact, "rejected");
      toast.success(t("reviews.rejected"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("reviews.reject_failed"));
    } finally {
      setWorkingId(null);
    }
  }

  const reviewablePaginated = useMemo(
    () => paginatedFacts.filter((f) => f.status === "needs_review"),
    [paginatedFacts],
  );

  const allVisibleSelected =
    reviewablePaginated.length > 0 &&
    reviewablePaginated.every((f) => selected.has(f.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const f of reviewablePaginated) next.delete(f.id);
        return next;
      }
      const next = new Set(prev);
      for (const f of reviewablePaginated) next.add(f.id);
      return next;
    });
  }

  async function handleBatchApprove() {
    if (selected.size === 0) return;
    setBatchWorking(true);
    const targets = facts.filter(
      (f) => selected.has(f.id) && f.status === "needs_review",
    );
    const failures: string[] = [];
    for (const fact of targets) {
      try {
        await applyFactStatus(fact, "confirmed");
      } catch (err) {
        failures.push(
          `${fact.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }
    setSelected(new Set());
    setBatchWorking(false);
    if (failures.length > 0) {
      toast.error(
        t("reviews.confirmed_with_failures", undefined, {
          count: failures.length,
          failures: failures.join("; "),
        }),
      );
    } else {
      toast.success(t("reviews.confirmed_count", undefined, { count: targets.length }));
    }
  }

  async function handleBatchReject() {
    if (selected.size === 0) return;
    setBatchWorking(true);
    const targets = facts.filter(
      (f) => selected.has(f.id) && f.status === "needs_review",
    );
    const failures: string[] = [];
    for (const fact of targets) {
      try {
        await applyFactStatus(fact, "rejected");
      } catch (err) {
        failures.push(
          `${fact.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }
    setSelected(new Set());
    setBatchWorking(false);
    if (failures.length > 0) {
      toast.error(
        t("reviews.rejected_with_failures", undefined, {
          count: failures.length,
          failures: failures.join("; "),
        }),
      );
    } else {
      toast.success(t("reviews.rejected_count", undefined, { count: targets.length }));
    }
  }

  const columns: DataTableColumn<BusinessFact>[] = useMemo(
    () => [
      {
        key: "select",
        header: t("reviews.col_select"),
        render: (row) =>
          row.status === "needs_review" ? (
            <input
              type="checkbox"
              aria-label={`Select fact ${row.id}`}
              checked={selected.has(row.id)}
              onChange={() => toggleOne(row.id)}
              className="h-4 w-4 cursor-pointer rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
          ) : (
            <span className="text-xs text-ink-muted">—</span>
          ),
      },
      {
        key: "category",
        header: t("reviews.col_category"),
        render: (row) => <Badge variant="info">{row.category}</Badge>,
      },
      {
        key: "label",
        header: t("reviews.col_label"),
        render: (row) => (
          <span className="truncate block max-w-[200px]" title={row.label}>
            {row.label}
          </span>
        ),
      },
      {
        key: "value",
        header: t("reviews.col_value"),
        render: (row) => (
          <span
            className="truncate block max-w-[300px]"
            title={row.value ?? ""}
          >
             {row.value ?? t("reviews.no_value")}
          </span>
        ),
      },
      {
        key: "confidence",
        header: t("reviews.col_confidence"),
        render: (row) =>
          row.confidence != null ? `${Math.round(row.confidence * 100)}%` : "—",
      },
      {
        key: "source_type",
        header: t("reviews.col_source"),
        render: (row) => <Badge variant="default">{row.source_type}</Badge>,
      },
      {
        key: "source_ref",
        header: t("reviews.col_source_ref"),
        render: (row) => {
          const text = row.source_ref ?? "";
          return (
            <span
              className="truncate block max-w-[200px]"
              title={text}
            >
               {text.length > 50 ? `${text.slice(0, 50)}…` : text || t("reviews.no_value")}
            </span>
          );
        },
      },
      {
        key: "status",
        header: t("reviews.col_status"),
        render: (row) => (
          <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
        ),
      },
      {
        key: "actions",
        header: t("reviews.col_actions"),
        render: (row) =>
          row.status === "needs_review" ? (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                disabled={workingId === row.id}
                onClick={() => handleApprove(row)}
              >
                   {workingId === row.id ? t("reviews.working") : t("reviews.approve")}
              </Button>
              <Button
                   variant="secondary"
                   disabled={workingId === row.id}
                   onClick={() => handleReject(row)}
                 >
                   {t("reviews.reject")}
              </Button>
            </div>
          ) : (
            <span className="text-xs text-ink-muted">—</span>
          ),
      },
    ],
    [selected, workingId],
  );

  return (
    <div className="space-y-6">
      <div>
      <h1 className="text-2xl font-semibold text-ink">{t("reviews.title")}</h1>
        <p className="text-sm text-ink-muted">
          {t("reviews.subtitle")}
        </p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select
            label={t("reviews.filter_category")}
            value={category}
            onChange={(v) => setParam("category", v)}
            options={[
              { value: "", label: t("reviews.filter_all_categories") },
              { value: "products", label: t("reviews.category_products") },
              { value: "customers", label: t("reviews.category_customers") },
              { value: "operations", label: t("reviews.category_operations") },
              { value: "policy", label: t("reviews.category_policy") },
              { value: "general", label: t("reviews.category_general") },
            ]}
          />
          <Select
            label={t("reviews.filter_status")}
            value={status}
            onChange={(v) => setParam("status", v)}
            options={[
              { value: "", label: t("reviews.filter_all_statuses") },
              { value: "needs_review", label: t("reviews.status_needs_review") },
              { value: "confirmed", label: t("reviews.status_confirmed") },
              { value: "rejected", label: t("reviews.status_rejected") },
            ]}
          />
        </div>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              aria-label={t("reviews.select_all")}
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              disabled={reviewablePaginated.length === 0}
              className="h-4 w-4 cursor-pointer rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {t("reviews.select_all")}
          </label>
          <span className="text-sm text-ink-muted">
            {t("reviews.selected_count", undefined, { count: selected.size })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            disabled={batchWorking || selected.size === 0}
            onClick={handleBatchApprove}
            >
              {batchWorking ? t("reviews.working") : t("reviews.approve_selected")}
            </Button>
            <Button
              variant="secondary"
              disabled={batchWorking || selected.size === 0}
              onClick={handleBatchReject}
            >
              {t("reviews.reject_selected")}
            </Button>
            <Button
              variant="secondary"
              disabled={batchWorking || selected.size === 0}
              onClick={() => setSelected(new Set())}
            >
              {t("reviews.clear")}
          </Button>
        </div>
      </Card>

      <Card>
        <DataTable<BusinessFact>
          columns={columns}
          data={paginatedFacts}
          isLoading={isLoading}
          emptyState={
             <EmptyState
              title={t("reviews.no_pending_title")}
              description={t("reviews.no_pending_desc")}
            />
          }
        />
        {totalItems > 0 && (
          <div className="border-t border-gray-100 p-4">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={totalItems}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
