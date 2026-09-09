import { useState, useEffect, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { t } from "@/i18n";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { useExtractFacts } from "../hooks";
import { useCreateAuditLog } from "@/features/audit/hooks";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { scrapeSchema, validateForm } from "@/lib/validation";

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

function isSocialHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.includes("facebook.com") || hostname.includes("instagram.com");
  } catch {
    return false;
  }
}

interface Fact {
  category: string;
  label: string;
  value: string;
  confidence: number;
  quote: string;
}

interface FactsResultProps {
  facts: Fact[];
  businessName: string;
  warning?: string;
  t: (key: string, fallback?: string) => string;
}

function FactsResult({ facts, businessName, warning, t }: FactsResultProps) {
  if (facts.length === 0 && !warning) {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink-muted">{t("extraction.website.no_facts")}</p>
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-ink">{businessName}</h2>
      </div>

      {warning && (
        <Card className="p-4 border-yellow-200 bg-yellow-50">
          <p className="text-sm text-yellow-800">{warning}</p>
        </Card>
      )}

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
                  <span>{interpolate(t("extraction.common.confidence"), { percent: Math.round(fact.confidence) })}</span>
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

export function ExtractFactsPage() {
  const navigate = useNavigate();
  const extract = useExtractFacts();
  const createAuditLog = useCreateAuditLog();
  const toast = useToast();

  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const result = extract.data;
  const facts = result?.facts ?? [];
  const businessName = result?.businessName ?? "";
  const warning = result?.warning;
  const canExtract = url.trim().length > 0 && !extract.isPending;
  const canSave = facts.length > 0 && !saving;

  useEffect(() => {
    if (extract.isError) {
      toast.error(
        extract.error instanceof Error
          ? extract.error.message
          : t("extraction.website.error_generic"),
      );
    }
  }, [extract.isError, extract.error, toast]);

  function onUrlChange(e: ChangeEvent<HTMLInputElement>) {
    setUrl(e.target.value);
  }

  async function onExtract() {
    setFieldErrors({});
    const parsed = validateForm(scrapeSchema, { url });
    if (!parsed.success) {
      setFieldErrors(parsed.errors);
      return;
    }

    if (isSocialHost(parsed.data.url)) {
      setFieldErrors({
        url: t("extraction.website.social_not_supported"),
      });
      return;
    }

    try {
      await extract.mutateAsync({ url: parsed.data.url.trim() });
    } catch {
      toast.error(t("extraction.website.error_generic"));
    }
  }

  async function onSaveToQueue() {
    if (!result || facts.length === 0) return;
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const tenantId = sessionData.session?.user.id;
      if (!tenantId) throw new Error("Not authenticated");

      await createAuditLog.mutateAsync({
        tenant_id: tenantId,
        fact_id: null,
        actor: tenantId,
        action: "import",
        old_value: null,
        new_value: { source_type: "website_extraction", facts_count: facts.length, business_name: businessName },
      });

      navigate(`/apps/review`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("extraction.website.error_generic"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{t("extraction.website.title")}</h1>
        <p className="text-sm text-ink-muted">
          {t("extraction.website.description")}
        </p>
      </div>

      <Card className="space-y-4 p-6">
        <Input
          label={t("extraction.website.url_label")}
          value={url}
          onChange={onUrlChange}
          placeholder={t("extraction.website.url_placeholder")}
          error={fieldErrors.url}
        />

        <div className="flex justify-end">
          <Button onClick={onExtract} disabled={!canExtract}>
            {extract.isPending ? t("extraction.website.extracting") : t("extraction.website.extract_button")}
          </Button>
        </div>
      </Card>

      {extract.isPending && (
        <Card className="p-6">
          <p className="text-sm text-ink-muted">{t("extraction.website.extracting_facts")}</p>
        </Card>
      )}

      {result && !extract.isPending && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-ink">
              {interpolate(t("extraction.website.extracted_facts"), { count: facts.length })}
            </h2>
          </div>

          <FactsResult facts={facts} businessName={businessName} warning={warning} t={t} />

          {facts.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={onSaveToQueue} disabled={!canSave}>
                {saving ? t("extraction.website.saving") : t("extraction.website.save_button")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
