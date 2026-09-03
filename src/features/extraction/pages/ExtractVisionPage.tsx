import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { Money } from "@/components/Money";
import { useExtractVision } from "../hooks";
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function stripDataUrlPrefix(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) return dataUrl;
  return dataUrl.slice(commaIdx + 1);
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

export function ExtractVisionPage() {
  const navigate = useNavigate();
  const extract = useExtractVision();
  const createBatch = useCreateImportBatch();
  const createQueueItem = useCreateImportQueueItem();

  const [imageUrl, setImageUrl] = useState("");
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const result = extract.data;
  const products = result?.products ?? [];

  const previewUrl = fileDataUrl ?? (imageUrl.trim() || null);
  const hasInput = Boolean(fileDataUrl) || imageUrl.trim().length > 0;
  const canExtract = hasInput && !extract.isPending;
  const canSave = products.length > 0 && !saving;

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setFileDataUrl(dataUrl);
      setFileName(file.name);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to read file");
      setFileDataUrl(null);
      setFileName(null);
    }
  }

  function onClearFile() {
    setFileDataUrl(null);
    setFileName(null);
    setFileError(null);
  }

  async function onExtract() {
    setSaveError(null);
    try {
      if (fileDataUrl) {
        await extract.mutateAsync({
          imageBase64: stripDataUrlPrefix(fileDataUrl),
        });
      } else {
        await extract.mutateAsync({ imageUrl: imageUrl.trim() });
      }
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

      const verbatim = fileName
        ? `image:${fileName}`
        : imageUrl.trim().slice(0, 500);

      const batch = await createBatch.mutateAsync({
        tenant_id: tenantId,
        file_name: "AI Vision Extraction",
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
        <h1 className="text-2xl font-semibold text-ink">Extract from image</h1>
        <p className="text-sm text-ink-muted">
          Upload an image or paste an image URL. The AI will extract structured
          product data for you to review.
        </p>
      </div>

      <Card className="space-y-4 p-6">
        <div className="space-y-1.5">
          <label
            htmlFor="extract-vision-file"
            className="block text-sm font-medium text-ink"
          >
            Upload image
          </label>
          <input
            id="extract-vision-file"
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="block w-full text-sm text-ink file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
          />
          {fileName && (
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <span>Selected: {fileName}</span>
              <button
                type="button"
                onClick={onClearFile}
                className="text-brand-700 hover:underline"
              >
                Clear
              </button>
            </div>
          )}
          {fileError && <p className="text-xs text-danger">{fileError}</p>}
        </div>

        <div className="text-center text-xs text-ink-muted">or</div>

        <Input
          label="Image URL"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://example.com/product.jpg"
          disabled={Boolean(fileDataUrl)}
        />

        {previewUrl && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-medium text-ink-muted">Preview</p>
            <img
              src={previewUrl}
              alt="Selected preview"
              className="max-h-64 rounded-md object-contain"
            />
          </div>
        )}

        {extract.isError && (
          <p className="text-sm text-danger">
            {extract.error instanceof Error
              ? extract.error.message
              : "Extraction failed"}
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={onExtract} disabled={!canExtract}>
            {extract.isPending ? "Extracting…" : "Extract from Image"}
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
