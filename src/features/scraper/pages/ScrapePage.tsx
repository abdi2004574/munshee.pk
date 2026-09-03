import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { Money } from "@/components/Money";
import { useScrape } from "../hooks";
import {
  useCreateImportBatch,
  useCreateImportQueueItem,
} from "@/features/imports/hooks";
import { supabase } from "@/lib/supabase";
import type { JsonValue } from "@/lib/types";

const TRUNCATE_DESCRIPTION = 220;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}\u2026`;
}

interface ScrapedProduct {
  name?: string;
  sku?: string;
  description?: string;
  category?: string;
  brand?: string;
  variants?: Array<{
    name?: string;
    sku?: string;
    price?: number;
    currency?: string;
  }>;
  tags?: string[];
}

interface ProductsResultProps {
  products: ScrapedProduct[];
}

function ProductsResult({ products }: ProductsResultProps) {
  if (products.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink-muted">
          The scrape completed but no products were found in the response.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {products.map((product, idx) => (
        <Card key={`${product.sku ?? product.name}-${idx}`} className="p-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-ink">
                {product.name ?? "Unnamed product"}
              </h3>
              {product.sku && (
                <Badge variant="info">SKU: {product.sku}</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
              {product.category && (
                <span>
                  <span className="font-medium text-ink">Category:</span>{" "}
                  {product.category}
                </span>
              )}
              {product.brand && (
                <span>
                  <span className="font-medium text-ink">Brand:</span>{" "}
                  {product.brand}
                </span>
              )}
            </div>

            {product.description && (
              <p className="text-sm text-ink-muted">
                {truncate(product.description, TRUNCATE_DESCRIPTION)}
              </p>
            )}

            {product.variants && product.variants.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                <p className="text-xs font-medium text-ink-muted">Variants</p>
                <ul className="space-y-1">
                  {product.variants.map((variant, vIdx) => (
                    <li
                      key={`${variant.sku ?? variant.name ?? "variant"}-${vIdx}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-ink">
                        {variant.name ?? variant.sku ?? `Variant ${vIdx + 1}`}
                      </span>
                      {variant.price != null && (
                        <Money
                          value={variant.price}
                          currency={variant.currency ?? "PKR"}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {product.tags.map((tag) => (
                  <Badge key={tag} variant="default">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ScrapePage() {
  const navigate = useNavigate();
  const scrape = useScrape();
  const createBatch = useCreateImportBatch();
  const createQueueItem = useCreateImportQueueItem();

  const [url, setUrl] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const result = scrape.data;
  const products = result?.products ?? [];
  const canScrape = url.trim().length > 0 && !scrape.isPending;
  const canSave = products.length > 0 && !saving;

  function onUrlChange(e: ChangeEvent<HTMLInputElement>) {
    setUrl(e.target.value);
  }

  async function onScrape() {
    setSaveError(null);
    try {
      await scrape.mutateAsync(url.trim());
    } catch {
      // error displayed via scrape.error
    }
  }

  async function onSaveToQueue() {
    if (!result || products.length === 0) return;
    setSaveError(null);
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const tenantId = sessionData.session?.user.id;
      if (!tenantId) throw new Error("Not authenticated");

      const batch = await createBatch.mutateAsync({
        tenant_id: tenantId,
        file_name: `Scraped: ${url.trim()}`,
        table_name: "products",
        total_rows: products.length,
        processed_rows: 0,
        status: "review",
        error_log: null,
      });

      for (const product of products) {
        await createQueueItem.mutateAsync({
          tenant_id: tenantId,
          batch_id: batch.id,
          table_name: "products",
          payload: product as unknown as Record<string, JsonValue>,
          source_type: "scraper",
          confidence_score: null,
          verbatim_quote: `Scraped from ${url.trim()}`,
          needs_review: true,
          reviewed_at: null,
          status: "pending",
          error_message: null,
          target_row_id: null,
        });
      }

      navigate(`/apps/review?batch_id=${batch.id}`);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save to review queue",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Scrape products</h1>
        <p className="text-sm text-ink-muted">
          Enter a merchant website URL to scrape product data and review it
          before importing.
        </p>
      </div>

      <Card className="space-y-4 p-6">
        <Input
          label="Merchant website URL"
          value={url}
          onChange={onUrlChange}
          placeholder="https://example.com/products"
        />

        {scrape.isError && (
          <p className="text-sm text-danger">
            {scrape.error instanceof Error
              ? scrape.error.message
              : "Scrape failed"}
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={onScrape} disabled={!canScrape}>
            {scrape.isPending ? "Scraping\u2026" : "Scrape Products"}
          </Button>
        </div>
      </Card>

      {scrape.isPending && (
        <Card className="p-6">
          <p className="text-sm text-ink-muted">Scraping products\u2026</p>
        </Card>
      )}

      {result && !scrape.isPending && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-ink">
              Scraped products ({products.length})
            </h2>
            {saveError && <p className="text-sm text-danger">{saveError}</p>}
          </div>

          <ProductsResult products={products} />

          <div className="flex justify-end">
            <Button onClick={onSaveToQueue} disabled={!canSave}>
              {saving ? "Saving\u2026" : "Save to Review Queue"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
