import { useMemo, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import { Badge } from "@/components/Badge";
import { useToast } from "@/components/Toast";
import { parseCsv } from "../utils/csv";
import {
  useCreateImportBatch,
  useCreateImportQueueItem,
} from "../hooks";
import { supabase } from "@/lib/supabase";
import type { JsonValue } from "@/lib/types";

type TargetTable = "products" | "product_variants" | "customers";

interface TableSchema {
  table: TargetTable;
  label: string;
  fields: { name: string; required: boolean }[];
}

const TABLES: TableSchema[] = [
  {
    table: "products",
    label: "Products",
    fields: [
      { name: "sku", required: true },
      { name: "name", required: true },
      { name: "description", required: false },
      { name: "category", required: false },
      { name: "brand", required: false },
      { name: "status", required: false },
      { name: "tags", required: false },
      { name: "weight_grams", required: false },
    ],
  },
  {
    table: "product_variants",
    label: "Product Variants",
    fields: [
      { name: "sku", required: true },
      { name: "name", required: true },
      { name: "price", required: false },
      { name: "compare_at_price", required: false },
      { name: "cost_price", required: false },
      { name: "barcode", required: false },
      { name: "options", required: false },
      { name: "status", required: false },
    ],
  },
  {
    table: "customers",
    label: "Customers",
    fields: [
      { name: "full_name", required: true },
      { name: "email", required: false },
      { name: "phone", required: false },
      { name: "city", required: false },
      { name: "address", required: false },
      { name: "notes", required: false },
      { name: "tags", required: false },
    ],
  },
];

type Step = "upload" | "configure" | "processing";

type Mapping = Record<string, string>;

const SKIP_VALUE = "__skip__";

function coerceValue(raw: string, field: string): JsonValue {
  if (raw === "") return null;
  if (field === "tags") {
    const items = raw
      .split(/[,;|]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    return items;
  }
  if (
    field === "weight_grams" ||
    field === "price" ||
    field === "compare_at_price" ||
    field === "cost_price"
  ) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (field === "options") {
    try {
      const parsed = JSON.parse(raw);
      return parsed as JsonValue;
    } catch {
      return raw;
    }
  }
  return raw;
}

export function ImportNewPage() {
  const navigate = useNavigate();
  const createBatch = useCreateImportBatch();
  const createQueueItem = useCreateImportQueueItem();
  const toast = useToast();

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);

  const [tableName, setTableName] = useState<TargetTable>("products");
  const [mapping, setMapping] = useState<Mapping>({});
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const schema = useMemo(
    () => TABLES.find((t) => t.table === tableName) ?? TABLES[0],
    [tableName],
  );

  const previewRows = rows.slice(0, 5);

  const requiredMissing = useMemo(
    () => schema.fields.filter((f) => f.required && !mapping[f.name]).map((f) => f.name),
    [schema, mapping],
  );

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed = parseCsv(text);
        setHeaders(parsed.headers);
        setRows(parsed.rows);
        setStep("configure");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to parse CSV");
        setHeaders([]);
        setRows([]);
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
    };
    reader.readAsText(file);
  }

  function onTableChange(next: string) {
    const t = next as TargetTable;
    setTableName(t);
    const schemaNext = TABLES.find((s) => s.table === t)!;
    const auto: Mapping = {};
    for (const f of schemaNext.fields) {
      const match = headers.find(
        (h) => h.toLowerCase() === f.name.toLowerCase(),
      );
      auto[f.name] = match ?? "";
    }
    setMapping(auto);
  }

  function onMappingChange(field: string, value: string) {
    setMapping((prev) => ({ ...prev, [field]: value === SKIP_VALUE ? "" : value }));
  }

  async function startImport() {
    if (rows.length === 0) {
      toast.error("No rows to import");
      return;
    }
    if (requiredMissing.length > 0) {
      toast.error(`Required fields missing: ${requiredMissing.join(", ")}`);
      return;
    }

    setStep("processing");
    setProgress({ current: 0, total: rows.length });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const tenantId = sessionData.session?.user.id;
      if (!tenantId) throw new Error("Not authenticated");

      const batch = await createBatch.mutateAsync({
        tenant_id: tenantId,
        file_name: fileName || "import.csv",
        table_name: tableName,
        total_rows: rows.length,
        processed_rows: 0,
        status: "processing",
        error_log: null,
      });

      let processed = 0;

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const payload: Record<string, JsonValue> = {};
        const missing: string[] = [];

        for (const field of schema.fields) {
          const csvCol = mapping[field.name];
          if (!csvCol) continue;
          const idx = headers.indexOf(csvCol);
          if (idx < 0) continue;
          const raw = row[idx] ?? "";
          if (field.required && raw.trim() === "") {
            missing.push(field.name);
            continue;
          }
          payload[field.name] = coerceValue(raw, field.name);
        }

        try {
          if (missing.length > 0) {
            await createQueueItem.mutateAsync({
              tenant_id: tenantId,
              batch_id: batch.id,
              table_name: tableName,
              payload: payload as Record<string, JsonValue>,
              source_type: "csv_import",
              confidence_score: null,
              verbatim_quote: null,
              needs_review: true,
              reviewed_at: null,
              status: "error",
              error_message: `missing required field: ${missing[0]}`,
              target_row_id: null,
            });
          } else {
            await createQueueItem.mutateAsync({
              tenant_id: tenantId,
              batch_id: batch.id,
              table_name: tableName,
              payload: payload as Record<string, JsonValue>,
              source_type: "csv_import",
              confidence_score: null,
              verbatim_quote: null,
              needs_review: true,
              reviewed_at: null,
              status: "pending",
              error_message: null,
              target_row_id: null,
            });
          }
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "failed",
          );
        }

        processed += 1;
        setProgress({ current: processed, total: rows.length });
      }

      await createBatch.mutateAsync({
        tenant_id: tenantId,
        file_name: batch.file_name,
        table_name: batch.table_name,
        total_rows: batch.total_rows,
        processed_rows: processed,
        status: "review",
        error_log: null,
      });

      navigate(`/apps/review?batch_id=${batch.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      setStep("configure");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Import data</h1>
        <p className="text-sm text-ink-muted">
          Upload a CSV file and map its columns to your data.
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Badge variant={step === "upload" ? "info" : "default"}>1. Upload</Badge>
        <Badge variant={step === "configure" ? "info" : "default"}>2. Configure</Badge>
        <Badge variant={step === "processing" ? "info" : "default"}>3. Processing</Badge>
      </div>

      {step === "upload" && (
        <Card className="p-6 space-y-4">
          <label className="block text-sm font-medium text-ink">
            Choose a CSV file
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={onFileChange}
            className="block w-full text-sm text-ink file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
          />
        </Card>
      )}

      {step === "configure" && (
        <div className="space-y-6">
          <Card className="p-6 space-y-3">
            <h2 className="text-lg font-medium text-ink">Preview</h2>
            <p className="text-sm text-ink-muted">
              Showing first {previewRows.length} of {rows.length} rows from {fileName || "file"}.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {headers.map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left font-medium text-ink-muted"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} className="border-b border-gray-50">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-ink">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <Select
              label="Target table"
              value={tableName}
              onChange={onTableChange}
              options={TABLES.map((t) => ({ value: t.table, label: t.label }))}
            />
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-ink">Column mapping</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {schema.fields.map((f) => (
                  <Select
                    key={f.name}
                    label={`${f.name}${f.required ? " *" : ""}`}
                    value={mapping[f.name] ?? ""}
                    onChange={(v) => onMappingChange(f.name, v)}
                    options={[
                      { value: SKIP_VALUE, label: "(skip)" },
                      ...headers.map((h) => ({ value: h, label: h })),
                    ]}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
              {requiredMissing.length === 0 ? (
                <p className="text-success">All required fields are mapped.</p>
              ) : (
                <p className="text-warning">
                  Unmapped required fields: {requiredMissing.join(", ")}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                disabled={requiredMissing.length > 0 || rows.length === 0}
                onClick={startImport}
              >
                Import
              </Button>
            </div>
          </Card>
        </div>
      )}

      {step === "processing" && (
        <Card className="p-6 space-y-3">
          <h2 className="text-lg font-medium text-ink">Importing</h2>
          {progress ? (
            <p className="text-sm text-ink-muted">
              Importing row {progress.current} of {progress.total}…
            </p>
          ) : (
            <p className="text-sm text-ink-muted">Preparing…</p>
          )}
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{
                width:
                  progress && progress.total > 0
                    ? `${Math.round((progress.current / progress.total) * 100)}%`
                    : "0%",
              }}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
