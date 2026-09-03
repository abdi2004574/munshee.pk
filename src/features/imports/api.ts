import { supabase } from "@/lib/supabase";
import type {
  ImportBatch,
  ImportBatchInsert,
  ImportQueueItem,
  ImportQueueItemInsert,
} from "@/lib/types";

async function getTenantId() {
  const { data } = await supabase.auth.getSession();
  const tenantId = data.session?.user.id;
  if (!tenantId) throw new Error("Not authenticated");
  return tenantId;
}

export async function createImportBatch(
  data: ImportBatchInsert,
): Promise<ImportBatch> {
  const tenantId = await getTenantId();
  const { data: created, error } = await supabase
    .from("import_batches" as never)
    .insert({ ...data, tenant_id: tenantId } as never)
    .select("*")
    .single();
  if (error) throw error;
  return created as unknown as ImportBatch;
}

export async function getImportBatch(id: string): Promise<ImportBatch | null> {
  const { data, error } = await supabase
    .from("import_batches" as never)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as unknown as ImportBatch;
}

export async function listImportBatches(): Promise<ImportBatch[]> {
  const tenantId = await getTenantId();
  const { data, error } = await supabase
    .from("import_batches" as never)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ImportBatch[];
}

export async function updateImportBatch(
  id: string,
  data: Partial<ImportBatchInsert>,
): Promise<ImportBatch> {
  const { data: updated, error } = await supabase
    .from("import_batches" as never)
    .update(data as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return updated as unknown as ImportBatch;
}

export async function createImportQueueItem(
  data: ImportQueueItemInsert,
): Promise<ImportQueueItem> {
  const tenantId = await getTenantId();
  const { data: created, error } = await supabase
    .from("import_queue" as never)
    .insert({ ...data, tenant_id: tenantId } as never)
    .select("*")
    .single();
  if (error) throw error;
  return created as unknown as ImportQueueItem;
}

export interface ListImportQueueFilters {
  batch_id?: string;
  table_name?: string;
  status?: string;
}

export async function listImportQueue(
  filters: ListImportQueueFilters = {},
): Promise<ImportQueueItem[]> {
  const tenantId = await getTenantId();
  let query = supabase
    .from("import_queue" as never)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (filters.batch_id) {
    query = query.eq("batch_id", filters.batch_id);
  }
  if (filters.table_name) {
    query = query.eq("table_name", filters.table_name);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ImportQueueItem[];
}

export async function getImportQueueItem(
  id: string,
): Promise<ImportQueueItem | null> {
  const { data, error } = await supabase
    .from("import_queue" as never)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as unknown as ImportQueueItem;
}
