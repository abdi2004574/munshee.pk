import { useState, type FormEvent } from "react";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/Button";
import { useCreateVariant } from "../hooks";
import type { ProductVariant, ProductVariantInsert } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

interface VariantEditorProps {
  productId: string;
  onCreated?: (variant: ProductVariant) => void;
}

export function VariantEditor({ productId, onCreated }: VariantEditorProps) {
  const create = useCreateVariant(productId);
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [cost, setCost] = useState("");
  const [barcode, setBarcode] = useState("");
  const [options, setOptions] = useState("{}");
  const [status, setStatus] = useState<ProductVariant["status"]>("active");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      let parsedOptions: Record<string, unknown> = {};
      const trimmed = options.trim();
      if (trimmed && trimmed !== "{}") {
        parsedOptions = JSON.parse(trimmed);
      }
      const payload: Omit<ProductVariantInsert, "product_id" | "tenant_id"> = {
        sku: sku.trim(),
        name: name.trim(),
        price: Number(price),
        compare_at_price: compareAt.trim() === "" ? null : Number(compareAt),
        cost_price: cost.trim() === "" ? null : Number(cost),
        barcode: barcode.trim() || null,
        options: parsedOptions as ProductVariant["options"],
        status,
        currency: "PKR",
        metadata: null,
      };
      const created = await create.mutateAsync(payload);
      onCreated?.(created);
      setSku(""); setName(""); setPrice(""); setCompareAt(""); setCost("");
      setBarcode(""); setOptions("{}"); setStatus("active");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save variant");
    }
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>Add Variant</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-100 bg-surface-muted p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} required />
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Price (PKR)" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
        <Input label="Compare at price" type="number" step="0.01" min="0" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} />
        <Input label="Cost price" type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} />
        <Input label="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        <Select label="Status" value={status} onChange={(v) => setStatus(v as ProductVariant["status"])} options={STATUS_OPTIONS} />
      </div>
      <Textarea label="Options (JSON)" value={options} onChange={(e) => setOptions(e.target.value)} rows={3} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" disabled={create.isPending}>{create.isPending ? "Saving…" : "Save variant"}</Button>
      </div>
    </form>
  );
}
