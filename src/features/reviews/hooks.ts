import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  approveImportItem,
  rejectImportItem,
} from "./api";

const IMPORT_QUEUE_KEY = ["import-queue"] as const;
const IMPORT_BATCHES_KEY = ["import-batches"] as const;

export function useApproveImportItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ queueId, targetRowId }: { queueId: string; targetRowId: string }) =>
      approveImportItem(queueId, targetRowId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: IMPORT_QUEUE_KEY });
      qc.invalidateQueries({ queryKey: IMPORT_BATCHES_KEY });
    },
  });
}

export function useRejectImportItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (queueId: string) => rejectImportItem(queueId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: IMPORT_QUEUE_KEY });
      qc.invalidateQueries({ queryKey: IMPORT_BATCHES_KEY });
    },
  });
}
