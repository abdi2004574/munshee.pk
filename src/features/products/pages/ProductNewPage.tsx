import { useNavigate } from "react-router";
import { useCreateProduct } from "../hooks";
import { ProductForm } from "../components/ProductForm";
import { Card } from "@/components/Card";
import type { ProductInsert } from "@/lib/types";

export function ProductNewPage() {
  const navigate = useNavigate();
  const create = useCreateProduct();

  async function onSubmit(data: ProductInsert) {
    await create.mutateAsync(data);
    navigate("/apps/products");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">New product</h1>
        <p className="text-sm text-ink-muted">Create a new product in your catalog.</p>
      </div>
      <Card className="p-6">
        <ProductForm onSubmit={onSubmit} submitLabel="Create product" />
      </Card>
    </div>
  );
}
