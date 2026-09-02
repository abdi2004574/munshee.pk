import { useState, type FormEvent } from "react";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/Button";
import { supabase } from "@/lib/supabase";
import type { Product, ProductInsert } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

interface ProductFormProps {
  defaultValues?: Partial<Product>;
  onSubmit: (data: ProductInsert) => void | Promise<void>;
  submitLabel?: string;
}

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function ProductForm({ defaultValues, onSubmit, submitLabel = "Save" }: ProductFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [sku, setSku] = useState(defaultValues?.sku ?? "");
  const [description, setDescription] = useState(defaultValues?.description ?? "");
  const [category, setCategory] = useState(defaultValues?.category ?? "uncategorized");
  const [brand, setBrand] = useState(defaultValues?.brand ?? "");
  const [status, setStatus] = useState<Product["status"]>(defaultValues?.status ?? "draft");
  const [tagsInput, setTagsInput] = useState((defaultValues?.tags ?? []).join(", "));
  const [weight, setWeight] = useState<string>(
    defaultValues?.weight_grams != null ? String(defaultValues.weight_grams) : "",
  )
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const tenantId = sessionData.session?.user.id;
      if (!tenantId) throw new Error("Not authenticated");

      const payload: ProductInsert = {
        tenant_id: tenantId,
        name: name.trim(),
        sku: sku.trim(),
        description: description.trim() || null,
        category: category.trim() || "uncategorized",
        brand: brand.trim() || null,
        status,
        tags: parseTags(tagsInput),
        weight_grams: weight.trim() === "" ? null : Number(weight),
        slug: null,
        metadata: null,
      };
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} required />
      <div className="md:col-span-2">
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
      </div>
      <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
      <Input label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
      <Select label="Status" value={status} onChange={(v) => setStatus(v as Product["status"])} options={STATUS_OPTIONS} />
      <Input label="Tags (comma separated)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
      <Input label="Weight (grams)" type="number" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} />

      {error && <p className="text-sm text-danger md:col-span-2">{error}</p>}

      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
