import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createImportBatch,
  getImportBatch,
  listImportBatches,
  createImportQueueItem,
  listImportQueue,
  type ListImportQueueFilters,
} from "./api";
import type { ImportBatchInsert, ImportQueueItemInsert } from "@/lib/types";

const IMPORT_BATCHES_KEY = ["import-batches"] as const;
const IMPORT_QUEUE_KEY = ["import-queue"] as const;

export function useImportBatches() {
  return useQuery({
    queryKey: IMPORT_BATCHES_KEY,
    queryFn: listImportBatches,
    staleTime: 30_000,
  });
}

export function useImportBatch(id: string | undefined) {
  return useQuery({
    queryKey: ["import-batch", id] as const,
    queryFn: () => getImportBatch(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreateImportBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ImportBatchInsert) => createImportBatch(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: IMPORT_BATCHES_KEY });
    },
  });
}

export function useImportQueue(filters: ListImportQueueFilters = {}) {
  return useQuery({
    queryKey: ["import-queue", filters] as const,
    queryFn: () => listImportQueue(filters),
    staleTime: 30_000,
  });
}

export function useCreateImportQueueItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ImportQueueItemInsert) => createImportQueueItem(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: IMPORT_QUEUE_KEY });
      qc.invalidateQueries({ queryKey: IMPORT_BATCHES_KEY });
    },
  });
}
