import { Badge } from "@/components/Badge";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

const STATUS_VARIANT: Record<string, "warning" | "info" | "success" | "default" | "danger"> = {
  pending: "warning",
  confirmed: "info",
  packed: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "default",
  returned: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status] ?? "default";
  return <Badge variant={variant}>{status}</Badge>;
}
