import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router";
import { useApproveImportItem, useRejectImportItem } from "../hooks";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { supabase } from "@/lib/supabase";
import type { ImportQueueItem, JsonValue } from "@/lib/types";

function statusVariant(status: string): "success" | "warning" | "danger" | "default" {
  if (status === "pending") return "warning";
  if (status === "approved") return "success";
  if (status === "rejected" || status === "error") return "danger";
  return "default";
}

function asString(v: JsonValue | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  return String(v);
}

function asNumber(v: JsonValue | undefined): number | "" {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

function asStringArray(v: JsonValue | undefined): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
  return String(v);
}

function asJsonString(v: JsonValue | undefined): string {
  if (v === null || v === undefined) return "{}";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const approve = useApproveImportItem();
  const reject = useRejectImportItem();

  const [item, setItem] = useState<ImportQueueItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [editedPayload, setEditedPayload] = useState<Record<string, JsonValue>>({});
  const [jsonDraft, setJsonDraft] = useState<string>("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchItem = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("import_queue" as never)
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      setLoadError(error.message);
      setItem(null);
    } else {
      const row = data as unknown as ImportQueueItem;
      setItem(row);
      setEditedPayload(row.payload ?? {});
      setJsonDraft(asJsonString(row.payload ?? {}));
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  const isKnownTable =
    item?.table_name === "products" ||
    item?.table_name === "product_variants" ||
    item?.table_name === "customers";

  function setField<K extends string>(key: K, value: JsonValue) {
    setEditedPayload((prev) => ({ ...prev, [key]: value }));
  }

  function setJsonDraftValue(value: string) {
    setJsonDraft(value);
    try {
      const parsed = JSON.parse(value) as JsonValue;
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        setJsonError("Must be a JSON object");
        return;
      }
      setJsonError(null);
      setEditedPayload(parsed as Record<string, JsonValue>);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }

  async function insertIntoRealTable(
    tableName: string,
    payload: Record<string, JsonValue>,
    queueItem: ImportQueueItem,
  ): Promise<string> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from(tableName as never)
      .insert({
        ...payload,
        tenant_id: authData.user.id,
        needs_review: true,
        source_type: queueItem.source_type,
        verbatim_quote: queueItem.verbatim_quote,
        confidence_score: queueItem.confidence_score,
      } as never)
      .select("id")
      .single();
    if (error) throw error;
    return (data as unknown as { id: string }).id;
  }

  async function handleSaveAndApprove() {
    if (!item) return;
    if (!isKnownTable && jsonError) {
      setSubmitError("Fix JSON errors before approving.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { error: updateError } = await supabase
        .from("import_queue" as never)
        .update({ payload: editedPayload } as never)
        .eq("id", item.id);
      if (updateError) throw updateError;

      const newRowId = await insertIntoRealTable(
        item.table_name,
        editedPayload,
        { ...item, payload: editedPayload },
      );
      await approve.mutateAsync({ queueId: item.id, targetRowId: newRowId });
      navigate("/apps/review");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    if (!item) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await reject.mutateAsync(item.id);
      navigate("/apps/review");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setSubmitting(false);
    }
  }

  const payloadJson = useMemo(
    () => JSON.stringify(item?.payload ?? {}, null, 2),
    [item],
  );

  if (isLoading) {
    return (
      <div className="text-sm text-ink-muted">Loading review item…</div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-danger">{loadError}</p>
        <Link to="/apps/review" className="text-sm text-brand-600 hover:underline">
          ? Back to review queue
        </Link>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">Item not found.</p>
        <Link to="/apps/review" className="text-sm text-brand-600 hover:underline">
          ? Back to review queue
        </Link>
      </div>
    );
  }

  const readOnly = item.status !== "pending";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Review Item</h1>
          <p className="text-sm text-ink-muted">
            {item.table_name} · <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
          </p>
        </div>
        <Link to="/apps/review" className="text-sm text-brand-600 hover:underline">
          ? Back to queue
        </Link>
      </div>

      {submitError && <p className="text-sm text-danger">{submitError}</p>}

      <Card className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-ink-muted">Source type</p>
            <Badge variant="default">{item.source_type}</Badge>
          </div>
          <div>
            <p className="text-xs uppercase text-ink-muted">Confidence</p>
            <p className="text-sm text-ink">
              {item.confidence_score != null
                ? `${Math.round(item.confidence_score * 100)}%`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-ink-muted">Status</p>
            <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase text-ink-muted">Verbatim quote</p>
          <p className="text-sm text-ink whitespace-pre-wrap">
            {item.verbatim_quote || "—"}
          </p>
        </div>
        {item.error_message && (
          <div>
            <p className="text-xs uppercase text-danger">Error message</p>
            <p className="text-sm text-danger">{item.error_message}</p>
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="text-lg font-semibold text-ink">Original payload</h2>
        <pre className="max-h-96 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-xs text-ink">
          {payloadJson}
        </pre>
      </Card>

      {!readOnly && (
        <Card className="space-y-4 p-4">
          <h2 className="text-lg font-semibold text-ink">Edit payload</h2>

          {item.table_name === "products" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Name"
                value={asString(editedPayload.name)}
                onChange={(e) => setField("name", e.target.value)}
              />
              <Input
                label="SKU"
                value={asString(editedPayload.sku)}
                onChange={(e) => setField("sku", e.target.value)}
              />
              <div className="md:col-span-2">
                <Textarea
                  label="Description"
                  value={asString(editedPayload.description)}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </div>
              <Input
                label="Category"
                value={asString(editedPayload.category)}
                onChange={(e) => setField("category", e.target.value)}
              />
              <Input
                label="Brand"
                value={asString(editedPayload.brand)}
                onChange={(e) => setField("brand", e.target.value)}
              />
              <Select
                label="Status"
                value={asString(editedPayload.status) || "active"}
                onChange={(v) => setField("status", v)}
                options={[
                  { value: "active", label: "Active" },
                  { value: "draft", label: "Draft" },
                  { value: "archived", label: "Archived" },
                ]}
              />
              <Input
                label="Tags (comma-separated)"
                value={asStringArray(editedPayload.tags)}
                onChange={(e) =>
                  setField(
                    "tags",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
              />
              <Input
                label="Weight (grams)"
                type="number"
                value={asNumber(editedPayload.weight_grams)}
                onChange={(e) =>
                  setField(
                    "weight_grams",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </div>
          )}

          {item.table_name === "product_variants" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="SKU"
                value={asString(editedPayload.sku)}
                onChange={(e) => setField("sku", e.target.value)}
              />
              <Input
                label="Name"
                value={asString(editedPayload.name)}
                onChange={(e) => setField("name", e.target.value)}
              />
              <Input
                label="Price"
                type="number"
                value={asNumber(editedPayload.price)}
                onChange={(e) =>
                  setField(
                    "price",
                    e.target.value === "" ? 0 : Number(e.target.value),
                  )
                }
              />
              <Input
                label="Compare at price"
                type="number"
                value={asNumber(editedPayload.compare_at_price)}
                onChange={(e) =>
                  setField(
                    "compare_at_price",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
              <Input
                label="Cost price"
                type="number"
                value={asNumber(editedPayload.cost_price)}
                onChange={(e) =>
                  setField(
                    "cost_price",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
              <Input
                label="Barcode"
                value={asString(editedPayload.barcode)}
                onChange={(e) => setField("barcode", e.target.value)}
              />
              <div className="md:col-span-2">
                <Textarea
                  label="Options (JSON)"
                  value={asJsonString(editedPayload.options)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value) as JsonValue;
                      setField("options", parsed);
                    } catch {
                      setField("options", e.target.value);
                    }
                  }}
                />
              </div>
              <Select
                label="Status"
                value={asString(editedPayload.status) || "active"}
                onChange={(v) => setField("status", v)}
                options={[
                  { value: "active", label: "Active" },
                  { value: "draft", label: "Draft" },
                  { value: "archived", label: "Archived" },
                ]}
              />
            </div>
          )}

          {item.table_name === "customers" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Full name"
                value={asString(editedPayload.full_name)}
                onChange={(e) => setField("full_name", e.target.value)}
              />
              <Input
                label="Email"
                type="email"
                value={asString(editedPayload.email)}
                onChange={(e) => setField("email", e.target.value)}
              />
              <Input
                label="Phone"
                value={asString(editedPayload.phone)}
                onChange={(e) => setField("phone", e.target.value)}
              />
              <Input
                label="City"
                value={asString(editedPayload.city)}
                onChange={(e) => setField("city", e.target.value)}
              />
              <div className="md:col-span-2">
                <Textarea
                  label="Address"
                  value={asString(editedPayload.address)}
                  onChange={(e) => setField("address", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Textarea
                  label="Notes"
                  value={asString(editedPayload.notes)}
                  onChange={(e) => setField("notes", e.target.value)}
                />
              </div>
              <Input
                label="Tags (comma-separated)"
                value={asStringArray(editedPayload.tags)}
                onChange={(e) =>
                  setField(
                    "tags",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
              />
            </div>
          )}

          {!isKnownTable && (
            <Textarea
              label="Payload (JSON)"
              error={jsonError ?? undefined}
              value={jsonDraft}
              rows={12}
              onChange={(e) => setJsonDraftValue(e.target.value)}
            />
          )}
        </Card>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="secondary"
            disabled={submitting}
            onClick={() => setConfirmOpen(true)}
          >
            Reject
          </Button>
          <Button
            variant="primary"
            disabled={submitting}
            onClick={handleSaveAndApprove}
          >
            {submitting ? "Saving…" : "Save & Approve"}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Reject this item?"
        description="This will mark the item as rejected and remove it from the pending queue."
        confirmLabel="Reject"
        cancelLabel="Cancel"
        onConfirm={async () => {
          setConfirmOpen(false);
          await handleReject();
        }}
        onCancel={() => setConfirmOpen(false)}
        isDestructive
      />
    </div>
  );
}
