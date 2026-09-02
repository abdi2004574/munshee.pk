import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useCustomers, useSoftDeleteCustomer } from "../hooks";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Customer } from "@/lib/types";

const PAGE_SIZE = 24;

export function CustomersListPage() {
  const [params, setParams] = useSearchParams();
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);

  const search = params.get("search") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const filters = useMemo(
    () => ({ search: search || undefined }),
    [search],
  );
  const pagination = useMemo(
    () => ({ from: (page - 1) * PAGE_SIZE, to: page * PAGE_SIZE - 1 }),
    [page],
  );

  const { data: customers = [], isLoading } = useCustomers(filters, pagination);
  const { data: allForCount } = useCustomers(filters, { from: 0, to: 9999 });
  const totalItems = allForCount?.length ?? 0;

  const softDelete = useSoftDeleteCustomer();

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

  const columns: DataTableColumn<Customer>[] = useMemo(
    () => [
      {
        key: "full_name",
        header: "Name",
        render: (row) => (
          <Link to={`/apps/customers/${row.id}`} className="font-medium text-ink hover:text-brand-600">
            {row.full_name}
          </Link>
        ),
      },
      { key: "email", header: "Email", render: (row) => row.email ?? "—" },
      { key: "phone", header: "Phone", render: (row) => row.phone ?? "—" },
      { key: "city", header: "City", render: (row) => row.city ?? "—" },
      {
        key: "tags",
        header: "Tags",
        render: (row) => row.tags.length ? row.tags.join(", ") : "—",
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <div className="flex items-center gap-2">
            <Link to={`/apps/customers/${row.id}`}>
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
          <h1 className="text-2xl font-semibold text-ink">Customers</h1>
          <p className="text-sm text-ink-muted">Manage your customer records.</p>
        </div>
        <Link to="/apps/customers/new">
          <Button>New Customer</Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="search"
            placeholder="Search by name, email, or phone"
            defaultValue={search}
            onBlur={(e) => setParam("search", e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </Card>

      <Card>
        <DataTable<Customer>
          columns={columns}
          data={customers}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              title="No customers yet"
              description="Get started by adding your first customer."
              action={
                <Link to="/apps/customers/new">
                  <Button>New Customer</Button>
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
        title="Delete customer?"
        description={
          pendingDelete
            ? `"${pendingDelete.full_name}" will be removed. This can be undone by an administrator.`
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
