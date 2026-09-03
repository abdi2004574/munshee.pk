import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { Badge } from "@/components/Badge";
import { Money } from "@/components/Money";
import { useExtractText } from "../hooks";
import {
  useCreateImportBatch,
  useCreateImportQueueItem,
} from "@/features/imports/hooks";
import { supabase } from "@/lib/supabase";
import type { JsonValue } from "@/lib/types";
import type { ExtractedProduct, ExtractedVariant } from "../api";

const TRUNCATE_DESCRIPTION = 220;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

interface ProductsResultProps {
  products: ExtractedProduct[];
}

function ProductsResult({ products }: ProductsResultProps) {
  if (products.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink-muted">
          The extraction completed but no products were found in the response.
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
              <h3 className="text-base font-semibold text-ink">{product.name}</h3>
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
                  {product.variants.map((variant: ExtractedVariant, vIdx) => (
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

export function ExtractTextPage() {
  const navigate = useNavigate();
  const extract = useExtractText();
  const createBatch = useCreateImportBatch();
  const createQueueItem = useCreateImportQueueItem();

  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const result = extract.data;
  const products = result?.products ?? [];
  const canExtract = text.trim().length > 0 && !extract.isPending;
  const canSave = products.length > 0 && !saving;

  function onTextChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
  }

  async function onExtract() {
    setSaveError(null);
    try {
      await extract.mutateAsync({
        text,
        context: context.trim() || undefined,
      });
    } catch {
      // error displayed via extract.error
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

      const verbatim = text.slice(0, 500);

      const batch = await createBatch.mutateAsync({
        tenant_id: tenantId,
        file_name: "AI Text Extraction",
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
          source_type: "ai_extraction",
          confidence_score: null,
          verbatim_quote: verbatim,
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
        <h1 className="text-2xl font-semibold text-ink">Extract from text</h1>
        <p className="text-sm text-ink-muted">
          Paste merchant copy, product descriptions, or website text. The AI will
          extract structured product data for you to review.
        </p>
      </div>

      <Card className="space-y-4 p-6">
        <Textarea
          label="Merchant text"
          value={text}
          onChange={onTextChange}
          rows={10}

        />
        <Input
          label="Context (optional)"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. Source website URL or category hint"
        />

        {extract.isError && (
          <p className="text-sm text-danger">
            {extract.error instanceof Error
              ? extract.error.message
              : "Extraction failed"}
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={onExtract} disabled={!canExtract}>
            {extract.isPending ? "Extracting…" : "Extract Products"}
          </Button>
        </div>
      </Card>

      {extract.isPending && (
        <Card className="p-6">
          <p className="text-sm text-ink-muted">Extracting products…</p>
        </Card>
      )}

      {result && !extract.isPending && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-ink">
              Extracted products ({products.length})
            </h2>
            {saveError && <p className="text-sm text-danger">{saveError}</p>}
          </div>

          <ProductsResult products={products} />

          <div className="flex justify-end">
            <Button onClick={onSaveToQueue} disabled={!canSave}>
              {saving ? "Saving…" : "Save to Review Queue"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
