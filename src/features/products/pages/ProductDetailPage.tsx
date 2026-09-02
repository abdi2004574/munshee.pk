import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useProduct, useSoftDeleteProduct, useUpdateProduct } from "../hooks";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Money } from "@/components/Money";
import { ProductForm } from "../components/ProductForm";
import { VariantEditor } from "../components/VariantEditor";
import { InventoryEditor } from "../components/InventoryEditor";
import type { ProductVariant } from "@/lib/types";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(id);
  const update = useUpdateProduct();
  const softDelete = useSoftDeleteProduct();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) {
    return <p className="text-sm text-ink-muted">Loading product…</p>;
  }
  if (!product) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">Product not found.</p>
        <Link to="/apps/products"><Button variant="secondary">Back to products</Button></Link>
      </div>
    );
  }

  const variantColumns: DataTableColumn<ProductVariant>[] = [
    { key: "name", header: "Name" },
    { key: "sku", header: "SKU", render: (row) => <span className="font-mono text-xs">{row.sku}</span> },
    { key: "price", header: "Price", render: (row) => <Money value={Number(row.price)} currency={row.currency} /> },
    { key: "status", header: "Status", render: (row) => <Badge>{row.status}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/apps/products" className="text-sm text-ink-muted hover:text-ink">← Products</Link>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{product.name}</h1>
          <p className="text-sm text-ink-muted">SKU: <span className="font-mono">{product.sku}</span></p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(true)}>Delete</Button>
        </div>
      </div>

      <Card className="p-6">
        {editing ? (
          <ProductForm
            defaultValues={product}
            onSubmit={async (data) => {
              await update.mutateAsync({ id: product.id, data });
              setEditing(false);
            }}
            submitLabel="Save changes"
          />
        ) : (
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><dt className="text-xs text-ink-muted">Category</dt><dd className="text-sm">{product.category}</dd></div>
            <div><dt className="text-xs text-ink-muted">Brand</dt><dd className="text-sm">{product.brand ?? "—"}</dd></div>
            <div><dt className="text-xs text-ink-muted">Status</dt><dd><Badge>{product.status}</Badge></dd></div>
            <div><dt className="text-xs text-ink-muted">Weight</dt><dd className="text-sm">{product.weight_grams != null ? `${product.weight_grams} g` : "—"}</dd></div>
            <div className="md:col-span-2"><dt className="text-xs text-ink-muted">Description</dt><dd className="text-sm whitespace-pre-wrap">{product.description ?? "—"}</dd></div>
            <div className="md:col-span-2"><dt className="text-xs text-ink-muted">Tags</dt><dd className="text-sm">{product.tags.length ? product.tags.join(", ") : "—"}</dd></div>
          </dl>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Variants</h2>
        </div>
        <DataTable<ProductVariant>
          columns={variantColumns}
          data={product.product_variants}
        />
        <VariantEditor productId={product.id} />
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-ink">Inventory</h2>
        <InventoryEditor variants={product.product_variants} />
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete product?"
        description={`"${product.name}" will be removed from your catalog.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await softDelete.mutateAsync(product.id);
          navigate("/apps/products");
        }}
      />
    </div>
  );
}
