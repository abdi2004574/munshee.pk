import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useImportQueue, useImportBatches } from "../../imports/hooks";
import { useApproveImportItem, useRejectImportItem } from "../hooks";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { supabase } from "@/lib/supabase";
import type { ImportQueueItem, JsonValue } from "@/lib/types";

const PAGE_SIZE = 25;

function statusVariant(status: string): "success" | "warning" | "danger" | "default" {
  if (status === "pending") return "warning";
  if (status === "approved") return "success";
  if (status === "rejected" || status === "error") return "danger";
  return "default";
}

export function ReviewQueuePage() {
  const [params, setParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const batchId = params.get("batch_id") ?? "";
  const tableName = params.get("table_name") ?? "";
  const status = params.get("status") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const filters = useMemo(
    () => ({
      batch_id: batchId || undefined,
      table_name: tableName || undefined,
      status: status || undefined,
    }),
    [batchId, tableName, status],
  );

  const { data: items = [], isLoading } = useImportQueue(filters);
  const { data: batches = [] } = useImportBatches();
  const approve = useApproveImportItem();
  const reject = useRejectImportItem();

  const totalItems = items.length;
  const paginatedItems = useMemo(
    () => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [items, page],
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

  if (success) {
    setTimeout(() => setSuccess(null), 3000);
  }

  async function insertIntoRealTable(
    tableName: string,
    payload: Record<string, JsonValue>,
    queueItem: ImportQueueItem,
  ): Promise<string> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from(tableName as never)
      .insert({
        ...payload,
        tenant_id: authData.user.id,
        needs_review: true,
        source_type: queueItem.source_type,
        verbatim_quote: queueItem.verbatim_quote,
        confidence_score: queueItem.confidence_score,
      } as never)
      .select("id")
      .single();
    if (error) throw error;
    return (data as unknown as { id: string }).id;
  }

  async function handleApprove(item: ImportQueueItem) {
    setApprovingId(item.id);
    setError(null);
    setSuccess(null);
    try {
      const newRowId = await insertIntoRealTable(item.table_name, item.payload, item);
      await approve.mutateAsync({ queueId: item.id, targetRowId: newRowId });
      setSuccess("Item approved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve item");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject(item: ImportQueueItem) {
    setError(null);
    setSuccess(null);
    try {
      await reject.mutateAsync(item.id);
      setSuccess("Item rejected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject item");
    }
  }

  function renderPayloadPreview(payload: Record<string, JsonValue>): string {
    const entries = Object.entries(payload).slice(0, 3);
    if (entries.length === 0) return "—";
    return entries.map(([k, v]) => `${k}: ${String(v)}`).join(", ");
  }

  const columns: DataTableColumn<ImportQueueItem>[] = useMemo(
    () => [
      {
        key: "table_name",
        header: "Table",
        render: (row) => <Badge variant="info">{row.table_name}</Badge>,
      },
      {
        key: "source_type",
        header: "Source",
        render: (row) => <Badge variant="default">{row.source_type}</Badge>,
      },
      {
        key: "confidence_score",
        header: "Confidence",
        render: (row) =>
          row.confidence_score != null
            ? `${Math.round(row.confidence_score * 100)}%`
            : "—",
      },
      {
        key: "payload",
        header: "Payload preview",
        render: (row) => (
          <span className="truncate block max-w-[300px]" title={JSON.stringify(row.payload)}>
            {renderPayloadPreview(row.payload)}
          </span>
        ),
      },
      {
        key: "verbatim_quote",
        header: "Verbatim",
        render: (row) => {
          const text = row.verbatim_quote ?? "";
          return text.length > 50 ? `${text.slice(0, 50)}…` : text || "—";
        },
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) =>
          row.status === "pending" ? (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                disabled={approvingId === row.id}
                onClick={() => handleApprove(row)}
              >
                {approvingId === row.id ? "Approving…" : "Approve"}
              </Button>
              <Button
                variant="secondary"
                disabled={approvingId === row.id}
                onClick={() => handleReject(row)}
              >
                Reject
              </Button>
            </div>
          ) : (
            <span className="text-xs text-ink-muted">—</span>
          ),
      },
    ],
    [approvingId],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Review Queue</h1>
        <p className="text-sm text-ink-muted">Review and approve imported items.</p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">{success}</p>}

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select
            label="Batch"
            value={batchId}
            onChange={(v) => setParam("batch_id", v)}
            options={[
              { value: "", label: "All batches" },
              ...batches.map((b) => ({ value: b.id, label: b.file_name })),
            ]}
          />
          <Select
            label="Table"
            value={tableName}
            onChange={(v) => setParam("table_name", v)}
            options={[
              { value: "", label: "All tables" },
              { value: "products", label: "Products" },
              { value: "product_variants", label: "Product Variants" },
              { value: "customers", label: "Customers" },
              { value: "inventory_levels", label: "Inventory Levels" },
            ]}
          />
          <Select
            label="Status"
            value={status}
            onChange={(v) => setParam("status", v)}
            options={[
              { value: "", label: "All statuses" },
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "error", label: "Error" },
            ]}
          />
        </div>
      </Card>

      <Card>
        <DataTable<ImportQueueItem>
          columns={columns}
          data={paginatedItems}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              title="No items pending review"
              description="Imported items will appear here for review."
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
