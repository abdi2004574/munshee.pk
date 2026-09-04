import { useState, useEffect, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { Money } from "@/components/Money";
import { useExtractVision } from "../hooks";
import { useCreateBusinessFacts } from "@/features/facts/hooks";
import { useCreateAuditLog } from "@/features/audit/hooks";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import type { BusinessFactInsert } from "@/features/facts/api";
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
        <Card key={`${product.sku.value ?? product.name.value}-${idx}`} className="p-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-ink">{product.name.value}</h3>
              {product.sku.value && (
                <Badge variant="info">SKU: {product.sku.value}</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
              {product.category.value && (
                <span>
                  <span className="font-medium text-ink">Category:</span>{" "}
                  {product.category.value}
                </span>
              )}
              {product.brand.value && (
                <span>
                  <span className="font-medium text-ink">Brand:</span>{" "}
                  {product.brand.value}
                </span>
              )}
            </div>

            {product.description.value && (
              <p className="text-sm text-ink-muted">
                {truncate(product.description.value, TRUNCATE_DESCRIPTION)}
              </p>
            )}

            {product.variants && product.variants.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                <p className="text-xs font-medium text-ink-muted">Variants</p>
                <ul className="space-y-1">
                  {product.variants.map((variant: ExtractedVariant, vIdx) => (
                    <li
                      key={`${variant.sku.value ?? variant.name.value ?? "variant"}-${vIdx}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-ink">
                        {variant.name.value ?? variant.sku.value ?? `Variant ${vIdx + 1}`}
                      </span>
                      {variant.price.value != null && (
                        <Money
                          value={variant.price.value}
                          currency="PKR"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {product.tags.value && product.tags.value.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {product.tags.value.map((tag) => (
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

type ProductFieldKey =
  | "name"
  | "sku"
  | "description"
  | "category"
  | "brand"
  | "status"
  | "tags"
  | "weight_grams";

const PRODUCT_FIELD_KEYS: ProductFieldKey[] = [
  "name",
  "sku",
  "description",
  "category",
  "brand",
  "status",
  "tags",
  "weight_grams",
];

const VARIANT_PRICING_FIELDS = ["price", "compare_at_price", "cost_price"] as const;
const VARIANT_PRODUCT_FIELDS = ["sku", "name", "barcode", "options", "status"] as const;

function buildFacts(
  products: ExtractedProduct[],
  tenantId: string,
  sourceRef: string,
): BusinessFactInsert[] {
  const facts: BusinessFactInsert[] = [];

  for (const product of products) {
    for (const key of PRODUCT_FIELD_KEYS) {
      const field = product[key];
      facts.push({
        tenant_id: tenantId,
        category: "product",
        label: key,
        value: String(field.value),
        confidence: field.confidence,
        source_ref: sourceRef,
        source_type: "vision_extraction",
        linked_table: "products",
        linked_row_id: null,
        status: "needs_review",
      });
    }

    for (const variant of product.variants ?? []) {
      for (const key of VARIANT_PRICING_FIELDS) {
        const field = variant[key];
        facts.push({
          tenant_id: tenantId,
          category: "pricing",
          label: key,
          value: String(field.value),
          confidence: field.confidence,
          source_ref: sourceRef,
          source_type: "vision_extraction",
          linked_table: "product_variants",
          linked_row_id: null,
          status: "needs_review",
        });
      }

      for (const key of VARIANT_PRODUCT_FIELDS) {
        const field = variant[key];
        facts.push({
          tenant_id: tenantId,
          category: "product",
          label: key,
          value: String(field.value),
          confidence: field.confidence,
          source_ref: sourceRef,
          source_type: "vision_extraction",
          linked_table: "product_variants",
          linked_row_id: null,
          status: "needs_review",
        });
      }
    }
  }

  return facts;
}

export function ExtractVisionPage() {
  const navigate = useNavigate();
  const extract = useExtractVision();
  const createBusinessFacts = useCreateBusinessFacts();
  const createAuditLog = useCreateAuditLog();
  const toast = useToast();

  const [imageUrl, setImageUrl] = useState("");
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const result = extract.data;
  const products = result?.products ?? [];

  const previewUrl = fileDataUrl ?? (imageUrl.trim() || "");
  const hasInput = Boolean(fileDataUrl) || imageUrl.trim().length > 0;
  const canExtract = hasInput && !extract.isPending;
  const canSave = products.length > 0 && !saving;

  useEffect(() => {
    if (extract.isError) {
      toast.error(
        extract.error instanceof Error
          ? extract.error.message
          : "Extraction failed",
      );
    }
  }, [extract.isError, extract.error, toast]);

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
    try {
      if (fileDataUrl) {
        await extract.mutateAsync({
          imageBase64: stripDataUrlPrefix(fileDataUrl),
        });
      } else {
        await extract.mutateAsync({ imageUrl: imageUrl.trim() });
      }
    } catch {
      // error displayed via toast
    }
  }

  async function onSaveToQueue() {
    if (!result || products.length === 0) return;
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const tenantId = sessionData.session?.user.id;
      if (!tenantId) throw new Error("Not authenticated");

      const sourceRef = fileName
        ? `image:${fileName}`
        : imageUrl.trim() || "";

      const factsArray = buildFacts(products, tenantId, sourceRef);

      await createBusinessFacts.mutateAsync(factsArray);

      await createAuditLog.mutateAsync({
        tenant_id: tenantId,
        fact_id: null,
        actor: tenantId,
        action: "import",
        old_value: null,
        new_value: { source_type: "vision_extraction", facts_count: factsArray.length },
      });

      navigate(`/apps/review`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save facts",
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
          {fileError && (
            <p className="text-xs text-danger" role="status">
              {fileError}
            </p>
          )}
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
          </div>

          <ProductsResult products={products} />

          <div className="flex justify-end">
            <Button onClick={onSaveToQueue} disabled={!canSave}>
              {saving ? "Saving…" : "Save to Facts"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
