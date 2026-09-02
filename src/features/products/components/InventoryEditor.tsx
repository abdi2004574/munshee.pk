import { useState, type FormEvent } from "react";
import { useInventory } from "@/features/inventory/hooks";
import { useAdjustInventory } from "@/features/inventory/hooks";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import type { ProductVariant } from "@/lib/types";

interface InventoryEditorProps {
  variants: ProductVariant[];
}

function AdjustForm({ variantId, location }: { variantId: string; location: string }) {
  const adjust = useAdjustInventory();
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);

  async function handle(type: "increment" | "decrement", e: FormEvent) {
    e.preventDefault();
    setError(null);
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Quantity must be > 0");
      return;
    }
    try {
      await adjust.mutateAsync({ variantId, quantity: qty, location, type });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <form className="flex items-end gap-2" onSubmit={(e) => handle("increment", e)}>
      <div className="w-20">
        <Input label="Qty" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </div>
      <Button type="submit" disabled={adjust.isPending}>+ Inc</Button>
      <Button type="button" variant="secondary" disabled={adjust.isPending}
        onClick={(e) => handle("decrement", e as unknown as FormEvent)}>- Dec</Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </form>
  );
}

export function InventoryEditor({ variants }: InventoryEditorProps) {
  const { data: inventory = [], isLoading } = useInventory();
  if (variants.length === 0) {
    return (
      <p className="text-sm text-ink-muted">Create a variant first to manage inventory.</p>
    );
  }

  const rows = variants.map((v) => {
    const matches = inventory.filter((row) => row.variant_id === v.id);
    const total = matches.reduce((sum, row) => sum + row.quantity_on_hand, 0);
    return { variant: v, total, matches };
  });

  return (
    <div className="space-y-2">
      {isLoading ? (
        <p className="text-sm text-ink-muted">Loading inventory…</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase">Variant</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase">SKU</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-ink-muted uppercase">On hand</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase">Locations</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase">Adjust</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ variant, total, matches: ms }) => {
              const loc = ms[0]?.location ?? "default";
              return (
                <tr key={variant.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-sm">{variant.name}</td>
                  <td className="px-3 py-2 text-sm font-mono text-xs">{variant.sku}</td>
                  <td className="px-3 py-2 text-sm text-right">{total}</td>
                  <td className="px-3 py-2 text-sm text-ink-muted">
                    {ms.length === 0 ? "—" : ms.map((m) => `${m.location}: ${m.quantity_on_hand}`).join(", ")}
                  </td>
                  <td className="px-3 py-2">
                    <AdjustForm variantId={variant.id} location={loc} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
