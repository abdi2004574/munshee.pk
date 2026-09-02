import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useProducts, useSoftDeleteProduct } from "../hooks";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Product } from "@/lib/types";

const PAGE_SIZE = 24;
const STATUS_OPTIONS = ["", "active", "draft", "archived"] as const;

function statusVariant(status: string): "success" | "warning" | "default" {
  if (status === "active") return "success";
  if (status === "draft") return "warning";
  return "default";
}

export function ProductsListPage() {
  const [params, setParams] = useSearchParams();
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);

  const search = params.get("search") ?? "";
  const status = params.get("status") ?? "";
  const category = params.get("category") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const filters = useMemo(
    () => ({ search: search || undefined, status: status || undefined, category: category || undefined }),
    [search, status, category],
  );
  const pagination = useMemo(
    () => ({ from: (page - 1) * PAGE_SIZE, to: page * PAGE_SIZE - 1 }),
    [page],
  );

  const { data: products = [], isLoading } = useProducts(filters, pagination);
  const { data: allForCount } = useProducts(filters, { from: 0, to: 9999 });
  const totalItems = allForCount?.length ?? 0;

  const softDelete = useSoftDeleteProduct();

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

  const columns: DataTableColumn<Product>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        render: (row) => (
          <Link to={`/apps/products/${row.id}`} className="font-medium text-ink hover:text-brand-600">
            {row.name}
          </Link>
        ),
      },
      { key: "sku", header: "SKU", render: (row) => <span className="font-mono text-xs">{row.sku}</span> },
      { key: "category", header: "Category" },
      {
        key: "status",
        header: "Status",
        render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
      },
      { key: "variants", header: "Variants", render: () => "—" },
      {
        key: "updated_at",
        header: "Updated",
        render: (row) => new Date(row.updated_at).toLocaleDateString(),
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <div className="flex items-center gap-2">
            <Link to={`/apps/products/${row.id}`}>
              <Button variant="secondary">Edit</Button>
            </Link>
            <Button variant="secondary" onClick={() => setPendingDelete(row)}>
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Products</h1>
          <p className="text-sm text-ink-muted">Manage your product catalog.</p>
        </div>
        <Link to="/apps/products/new">
          <Button>New Product</Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="search"
            placeholder="Search by name or SKU"
            defaultValue={search}
            onBlur={(e) => setParam("search", e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
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
          <input
            type="text"
            placeholder="Filter by category"
            defaultValue={category}
            onBlur={(e) => setParam("category", e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </Card>

      <Card>
        <DataTable<Product>
          columns={columns}
          data={products}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              title="No products yet"
              description="Get started by creating your first product."
              action={
                <Link to="/apps/products/new">
                  <Button>New Product</Button>
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete product?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" will be removed from your catalog. This can be undone by an administrator.`
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
