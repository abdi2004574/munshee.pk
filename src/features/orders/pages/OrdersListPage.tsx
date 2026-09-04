import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useOrders, useSoftDeleteOrder, useUpdateOrderStatus } from "../hooks";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Money } from "@/components/Money";
import { SkeletonCard } from "@/components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import type { Order } from "@/lib/types";

const PAGE_SIZE = 24;

const STATUS_OPTIONS = [
  "",
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;

const STATUS_TRANSITIONS = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;

export function OrdersListPage() {
  const [params, setParams] = useSearchParams();
  const [pendingDelete, setPendingDelete] = useState<Order | null>(null);

  const status = params.get("status") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const filters = useMemo(
    () => ({ status: status || undefined }),
    [status],
  );
  const pagination = useMemo(
    () => ({ from: (page - 1) * PAGE_SIZE, to: page * PAGE_SIZE - 1 }),
    [page],
  );

  const { data: orders = [], isLoading } = useOrders(filters, pagination);
  const { data: allForCount } = useOrders(filters, { from: 0, to: 9999 });
  const totalItems = allForCount?.length ?? 0;

  const softDelete = useSoftDeleteOrder();
  const updateStatus = useUpdateOrderStatus();

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

  const columns: DataTableColumn<Order>[] = useMemo(
    () => [
      {
        key: "order_number",
        header: "Order #",
        render: (row) => (
          <Link to={`/apps/orders/${row.id}`} className="font-mono text-xs font-medium text-ink hover:text-brand-600">
            {row.order_number}
          </Link>
        ),
      },
      {
        key: "customer",
        header: "Customer",
        render: (row) => row.customer_id ? (
          <span className="text-sm">{row.customer_id.slice(0, 8)}…</span>
        ) : (
          <span className="text-sm text-ink-muted">—</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "grand_total",
        header: "Grand Total",
        align: "right",
        render: (row) => <Money value={row.grand_total} currency={row.currency} />,
      },
      {
        key: "placed_at",
        header: "Placed At",
        render: (row) => row.placed_at ? new Date(row.placed_at).toLocaleString() : "—",
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/apps/orders/${row.id}`}>
              <Button variant="secondary">View</Button>
            </Link>
            <select
              value={row.status}
              disabled={updateStatus.isPending}
              onChange={(e) => {
                if (e.target.value === row.status) return;
                updateStatus.mutate({ id: row.id, status: e.target.value });
              }}
              className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Change status"
            >
              {STATUS_TRANSITIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <Button variant="secondary" onClick={() => setPendingDelete(row)}>
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [updateStatus.isPending, updateStatus],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Orders</h1>
          <p className="text-sm text-ink-muted">Manage your orders.</p>
        </div>
        <Link to="/apps/orders/new">
          <Button>New Order</Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select
            value={status}
            onChange={(e) => setParam("status", e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "" ? "All statuses" : opt}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {isLoading ? (
        <SkeletonCard />
      ) : (
        <Card>
          <DataTable<Order>
            columns={columns}
            data={orders}
            isLoading={isLoading}
            emptyState={
              <EmptyState
                title="No orders yet"
                description="Create your first order to get started."
                action={
                  <Link to="/apps/orders/new">
                    <Button>New Order</Button>
                  </Link>
                }
              />
            }
          />
          <div className="border-t border-gray-100 p-4">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={totalItems}
              onPageChange={setPage}
            />
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete order?"
        description={
          pendingDelete
            ? `Order "${pendingDelete.order_number}" will be removed. This can be undone by an administrator.`
            : undefined
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await softDelete.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
