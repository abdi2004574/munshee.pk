import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { useCreateOrderWithItems } from "../hooks";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { Money } from "@/components/Money";
import type { Customer, ProductVariant, Product } from "@/lib/types";
import { orderSchema, validateForm } from "@/lib/validation";

interface VariantWithProduct extends ProductVariant {
  product: Pick<Product, "name"> | null;
}

interface DraftLine {
  key: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  name: string;
  sku: string;
}

export function OrderNewPage() {
  const navigate = useNavigate();
  const createOrder = useCreateOrderWithItems();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [variants, setVariants] = useState<VariantWithProduct[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  const [customerId, setCustomerId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState<number>(1);

  const [items, setItems] = useState<DraftLine[]>([]);
  const [shippingTotal, setShippingTotal] = useState<string>("0");
  const [discountTotal, setDiscountTotal] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingLookups(true);
      try {
        const [customersRes, variantsRes] = await Promise.all([
          supabase
            .from("customers" as never)
            .select("id, full_name, phone")
            .is("deleted_at", null)
            .order("full_name", { ascending: true })
            .range(0, 9999),
          supabase
            .from("product_variants" as never)
            .select("*, product:products!product_variants_product_id_fkey(name)")
            .eq("status", "active")
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .range(0, 9999),
        ]);

        if (cancelled) return;
        if (customersRes.error) throw customersRes.error;
        if (variantsRes.error) throw variantsRes.error;

        setCustomers((customersRes.data ?? []) as unknown as Customer[]);
        setVariants((variantsRes.data ?? []) as unknown as VariantWithProduct[]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load options");
        }
      } finally {
        if (!cancelled) setLoadingLookups(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const variantOptions = useMemo(() => {
    return variants.map((v) => {
      const productName = v.product?.name ?? "Unknown product";
      const priceLabel = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(v.price));
      return {
        value: v.id,
        label: `${v.sku} - ${productName} - ${v.currency} ${priceLabel}`,
        variant: v,
      };
    });
  }, [variants]);

  function handleAddItem() {
    setError(null);
    setFieldErrors({});
    if (!variantId) {
      setFieldErrors({ "": "Please select a variant." });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFieldErrors({ "": "Quantity must be a positive number." });
      return;
    }
    const found = variants.find((v) => v.id === variantId);
    if (!found) {
      setFieldErrors({ "": "Selected variant not found." });
      return;
    }
    const line: DraftLine = {
      key: `${variantId}-${Date.now()}`,
      variant_id: variantId,
      quantity,
      unit_price: Number(found.price),
      name: found.name,
      sku: found.sku,
    };
    setItems((prev) => [...prev, line]);
    setVariantId("");
    setQuantity(1);
  }

  function removeLine(key: string) {
    setItems((prev) => prev.filter((l) => l.key !== key));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = validateForm(orderSchema, {
      customer_id: customerId || null,
      notes: notes || null,
      items: items.map((it) => ({ variant_id: it.variant_id, quantity: it.quantity })),
    });
    if (!parsed.success) {
      setFieldErrors(parsed.errors);
      if (items.length === 0) {
        setError("Add at least one line item.");
      }
      if (!customerId) {
        setError("Please select a customer.");
      }
      return;
    }

    const shipping = Number(shippingTotal) || 0;
    const discount = Number(discountTotal) || 0;

    setSubmitting(true);
    try {
      await createOrder.mutateAsync({
        customer_id: parsed.data.customer_id ?? "",
        items: parsed.data.items.map((it) => ({ variant_id: it.variant_id, quantity: it.quantity })),
        shipping_total: shipping,
        discount_total: discount,
        notes: parsed.data.notes ?? "",
      });
      navigate("/apps/orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  const subtotal = items.reduce(
    (acc, it) => acc + it.unit_price * it.quantity,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">New order</h1>
          <p className="text-sm text-ink-muted">Create a new order for a customer.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink">Customer</h2>
          <div className="mt-4">
            <label htmlFor="customer" className="block text-sm font-medium text-ink">
              Customer
            </label>
            <select
              id="customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={loadingLookups}
              required
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="" disabled>
                {loadingLookups ? "Loading customers…" : "Select a customer"}
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                  {c.phone ? ` — ${c.phone}` : ""}
                </option>
              ))}
            </select>
            {fieldErrors["customer_id"] && (
              <p className="text-xs text-danger">{fieldErrors["customer_id"]}</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink">Items</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px_auto]">
            <div>
              <label htmlFor="variant" className="block text-sm font-medium text-ink">
                Variant (SKU - Product Name - Price)
              </label>
              <select
                id="variant"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                disabled={loadingLookups}
                className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">
                  {loadingLookups ? "Loading variants…" : "Select a variant"}
                </option>
                {variantOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Quantity"
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
            <div className="flex items-end">
              <Button type="button" onClick={handleAddItem}>
                Add item
              </Button>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table role="table" className="w-full">
              <thead>
                <tr>
                  <th scope="col" className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">SKU</th>
                  <th scope="col" className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-4 py-3 bg-gray-50 text-right text-xs font-medium text-ink-muted uppercase tracking-wider">Quantity</th>
                  <th scope="col" className="px-4 py-3 bg-gray-50 text-right text-xs font-medium text-ink-muted uppercase tracking-wider">Unit Price</th>
                  <th scope="col" className="px-4 py-3 bg-gray-50 text-right text-xs font-medium text-ink-muted uppercase tracking-wider">Line Total</th>
                  <th scope="col" className="px-4 py-3 bg-gray-50"></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-sm text-ink-muted text-center border-t border-gray-100">
                      No items added yet.
                    </td>
                  </tr>
                ) : (
                  items.map((line) => (
                    <tr key={line.key}>
                      <td className="px-4 py-3 text-sm text-ink border-t border-gray-100 font-mono text-xs">{line.sku}</td>
                      <td className="px-4 py-3 text-sm text-ink border-t border-gray-100">{line.name}</td>
                      <td className="px-4 py-3 text-sm text-ink border-t border-gray-100 text-right">{line.quantity}</td>
                      <td className="px-4 py-3 text-sm text-ink border-t border-gray-100 text-right">
                        <Money value={line.unit_price} />
                      </td>
                      <td className="px-4 py-3 text-sm text-ink border-t border-gray-100 text-right">
                        <Money value={line.unit_price * line.quantity} />
                      </td>
                      <td className="px-4 py-3 text-sm text-ink border-t border-gray-100 text-right">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => removeLine(line.key)}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
                {items.length > 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm text-ink-muted text-right border-t border-gray-100">
                      Subtotal
                    </td>
                    <td className="px-4 py-3 text-sm text-ink border-t border-gray-100 text-right font-medium">
                      <Money value={subtotal} />
                    </td>
                    <td className="px-4 py-3 border-t border-gray-100"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink">Totals & notes</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Shipping total"
              type="number"
              min={0}
              step="0.01"
              value={shippingTotal}
              onChange={(e) => setShippingTotal(e.target.value)}
            />
            <Input
              label="Discount total"
              type="number"
              min={0}
              step="0.01"
              value={discountTotal}
              onChange={(e) => setDiscountTotal(e.target.value)}
            />
            <div className="md:col-span-2">
              <Textarea
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                error={fieldErrors.notes}
              />
            </div>
          </div>
        </Card>

        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate("/apps/orders")}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create order"}
          </Button>
        </div>
      </form>
    </div>
  );
}

