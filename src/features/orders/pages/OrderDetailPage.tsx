import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useOrder, useSoftDeleteOrder, useUpdateOrderStatus } from "../hooks";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Money } from "@/components/Money";
import { OrderItemsTable } from "../components/OrderItemsTable";
import { StatusBadge } from "../components/StatusBadge";

const UPDATABLE_STATUSES = ["pending", "confirmed", "packed", "shipped"] as const;
const ALL_STATUSES = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;

const LOCKED_STATUSES = ["delivered", "returned"];

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading } = useOrder(id);
  const updateStatus = useUpdateOrderStatus();
  const softDelete = useSoftDeleteOrder();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  if (isLoading) {
    return <p className="text-sm text-ink-muted">Loading order…</p>;
  }
  if (!order) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">Order not found.</p>
        <Link to="/apps/orders">
          <Button variant="secondary">Back to orders</Button>
        </Link>
      </div>
    );
  }

  const isLocked = LOCKED_STATUSES.includes(order.status);
  const canUpdateStatus = UPDATABLE_STATUSES.includes(
    order.status as (typeof UPDATABLE_STATUSES)[number],
  );

  const notes =
    order.metadata && typeof order.metadata === "object" && "notes" in order.metadata
      ? String((order.metadata as Record<string, unknown>).notes ?? "")
      : "";

  async function handleStatusChange(nextStatus: string) {
    if (!id || nextStatus === order?.status) return;
    setStatusError(null);
    try {
      await updateStatus.mutateAsync({ id, status: nextStatus });
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/apps/orders" className="text-sm text-ink-muted hover:text-ink">
            ? Orders
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-ink">
            <span className="font-mono">{order.order_number}</span>
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      </div>

      {isLocked && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          This order is locked and cannot be modified.
        </div>
      )}

      <Card className="p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-muted">Status</dt>
            <dd className="mt-1">
              <StatusBadge status={order.status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Grand Total</dt>
            <dd className="mt-1 text-sm font-medium">
              <Money value={order.grand_total} currency={order.currency} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Placed At</dt>
            <dd className="mt-1 text-sm">
              {order.placed_at ? new Date(order.placed_at).toLocaleString() : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Update Status</dt>
            <dd className="mt-1">
              {canUpdateStatus ? (
                <select
                  value={order.status}
                  disabled={updateStatus.isPending}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-ink-muted">Not editable</span>
              )}
              {statusError && (
                <p className="mt-1 text-xs text-danger">{statusError}</p>
              )}
            </dd>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">Customer</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-muted">Customer ID</dt>
            <dd className="text-sm font-mono text-xs">{order.customer_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Currency</dt>
            <dd className="text-sm">{order.currency}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-ink">Items</h2>
        </div>
        <div className="p-6">
          <OrderItemsTable items={order.order_items} currency={order.currency} />
        </div>
        <div className="border-t border-gray-100 px-6 py-4">
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
            <div>
              <dt className="text-xs text-ink-muted">Subtotal</dt>
              <dd><Money value={order.subtotal} currency={order.currency} /></dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Tax</dt>
              <dd><Money value={order.tax_total} currency={order.currency} /></dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Shipping</dt>
              <dd><Money value={order.shipping_total} currency={order.currency} /></dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Discount</dt>
              <dd><Money value={order.discount_total} currency={order.currency} /></dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Grand Total</dt>
              <dd className="font-medium"><Money value={order.grand_total} currency={order.currency} /></dd>
            </div>
          </dl>
        </div>
      </Card>

      {notes && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{notes}</p>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete order?"
        description={`Order "${order.order_number}" will be removed.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await softDelete.mutateAsync(order.id);
          navigate("/apps/orders");
        }}
      />
    </div>
  );
}
