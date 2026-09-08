import { useState, useEffect, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { Badge } from "@/components/Badge";
import { useExtractText } from "../hooks";
import { useCreateBusinessFacts } from "@/features/facts/hooks";
import { useCreateAuditLog } from "@/features/audit/hooks";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import type { BusinessFactInsert } from "@/features/facts/api";
import type { Fact } from "../api";
import { extractTextSchema, validateForm } from "@/lib/validation";

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

  const grouped = facts.reduce<Record<string, Fact[]>>((acc, fact) => {
    if (!acc[fact.category]) acc[fact.category] = [];
    acc[fact.category].push(fact);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([category, categoryFacts]) => (
        <Card key={category} className="p-4">
          <h3 className="text-sm font-medium text-ink mb-3 capitalize">{category}</h3>
          <div className="space-y-3">
            {categoryFacts.map((fact, idx) => (
              <div
                key={`${fact.label}-${idx}`}
                className="space-y-1 border-b border-gray-100 last:border-b-0 pb-3 last:pb-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{fact.label}</span>
                  <Badge variant="default" className="capitalize">{fact.category}</Badge>
                </div>
                <p className="text-sm text-ink-muted">{fact.value}</p>
                <div className="flex items-center gap-3 text-xs text-ink-muted">
                  <span>Confidence: {Math.round(fact.confidence)}%</span>
                </div>
                {fact.quote && (
                  <p className="text-xs text-ink-muted italic">"{fact.quote}"</p>
                )}
              </div>
            ))}
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

export function ExtractTextPage() {
  const navigate = useNavigate();
  const extract = useExtractText();
  const createBusinessFacts = useCreateBusinessFacts();
  const createAuditLog = useCreateAuditLog();
  const toast = useToast();

  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const result = extract.data;
  const facts = result?.facts ?? [];
  const canExtract = text.trim().length > 0 && !extract.isPending;
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

  function onTextChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
  }

  async function onExtract() {
    setFieldErrors({});
    const parsed = validateForm(extractTextSchema, { text, context });
    if (!parsed.success) {
      setFieldErrors(parsed.errors);
      return;
    }
    try {
      await extract.mutateAsync({
        text: parsed.data.text,
        context: parsed.data.context,
      });
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

      const factsArray = buildFactRows(facts, tenantId, "text_extraction");

      await createBusinessFacts.mutateAsync(factsArray);

      await createAuditLog.mutateAsync({
        tenant_id: tenantId,
        fact_id: null,
        actor: tenantId,
        action: "import",
        old_value: null,
        new_value: { source_type: "text_extraction", facts_count: factsArray.length },
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
        <h1 className="text-2xl font-semibold text-ink">Extract from text</h1>
        <p className="text-sm text-ink-muted">
          Paste merchant copy, product descriptions, or website text. The AI will
          extract structured business facts for you to review.
        </p>
      </div>

      <Card className="space-y-4 p-6">
        <Textarea
          label="Merchant text"
          value={text}
          onChange={onTextChange}
          rows={10}
          error={fieldErrors.text}
        />
        <Input
          label="Context (optional)"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. Source website URL or category hint"
          error={fieldErrors.context}
        />

        <div className="flex justify-end">
          <Button onClick={onExtract} disabled={!canExtract}>
            {extract.isPending ? "Extracting…" : "Extract Facts"}
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
