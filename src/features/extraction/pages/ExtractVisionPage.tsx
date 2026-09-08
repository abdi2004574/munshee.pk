import { useState, useEffect, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { useExtractVision } from "../hooks";
import { useCreateBusinessFacts } from "@/features/facts/hooks";
import { useCreateAuditLog } from "@/features/audit/hooks";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import type { BusinessFactInsert } from "@/features/facts/api";
import type { Fact } from "../api";

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

interface FactsResultProps {
  facts: Fact[];
}

function FactsResult({ facts }: FactsResultProps) {
  if (facts.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink-muted">
          The extraction completed but no facts were found in the response.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {facts.map((fact, idx) => (
        <Card key={`${fact.category}-${fact.label}-${idx}`} className="p-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-ink">{fact.label}</h3>
              <div className="flex items-center gap-2">
                <Badge variant="info">{fact.category}</Badge>
                <span className="text-xs text-ink-muted">
                  {Math.round(fact.confidence * 100)}%
                </span>
              </div>
            </div>

            <p className="text-sm text-ink">{fact.value}</p>

            {fact.quote && (
              <p className="text-xs text-ink-muted italic border-l-2 border-gray-200 pl-2">
                "{fact.quote}"
              </p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function buildFactRows(
  facts: Fact[],
  tenantId: string,
  sourceType: string,
): BusinessFactInsert[] {
  return facts.map((fact) => ({
    tenant_id: tenantId,
    category: fact.category,
    label: fact.label,
    value: fact.value,
    confidence: fact.confidence,
    status: "needs_review",
    source_type: sourceType,
    source_ref: fact.quote,
    linked_table: null,
    linked_row_id: null,
  }));
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
  const facts = result?.facts ?? [];

  const previewUrl = fileDataUrl ?? (imageUrl.trim() || "");
  const hasInput = Boolean(fileDataUrl) || imageUrl.trim().length > 0;
  const canExtract = hasInput && !extract.isPending;
  const canSave = facts.length > 0 && !saving;

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
    if (!result || facts.length === 0) return;
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const tenantId = sessionData.session?.user.id;
      if (!tenantId) throw new Error("Not authenticated");

      const factsArray = buildFactRows(facts, tenantId, "photo_ocr");

      await createBusinessFacts.mutateAsync(factsArray);

      await createAuditLog.mutateAsync({
        tenant_id: tenantId,
        fact_id: null,
        actor: tenantId,
        action: "import",
        old_value: null,
        new_value: { source_type: "photo_ocr", facts_count: factsArray.length },
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
          business facts for you to review.
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
          <p className="text-sm text-ink-muted">Extracting facts…</p>
        </Card>
      )}

      {result && !extract.isPending && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-ink">
              Extracted facts ({facts.length})
            </h2>
          </div>

          <FactsResult facts={facts} />

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