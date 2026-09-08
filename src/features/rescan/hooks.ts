import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  triggerRescan,
  getRescanSchedule,
  upsertRescanSchedule,
  listPendingReviewFacts,
} from "./api";

const RESCAN_SCHEDULE_KEY = ["rescan-schedule"] as const;
const PENDING_REVIEW_KEY = ["pending-review"] as const;

export function useRescanSchedule(businessId?: string) {
  return useQuery({
    queryKey: [...RESCAN_SCHEDULE_KEY, businessId ?? null],
    queryFn: () => getRescanSchedule(businessId!),
    enabled: !!businessId,
    staleTime: 60_000,
  });
}

export function useTriggerRescan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ businessId, url }: { businessId: string; url?: string }) =>
      triggerRescan(businessId, { url }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RESCAN_SCHEDULE_KEY });
      qc.invalidateQueries({ queryKey: PENDING_REVIEW_KEY });
    },
  });
}

export function useUpsertRescanSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ businessId, cadence }: { businessId: string; cadence: string }) =>
      upsertRescanSchedule(businessId, cadence),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RESCAN_SCHEDULE_KEY });
    },
  });
}

export function usePendingReviewFacts(businessId?: string) {
  return useQuery({
    queryKey: [...PENDING_REVIEW_KEY, businessId ?? null],
    queryFn: () => listPendingReviewFacts(businessId!),
    enabled: !!businessId,
    staleTime: 30_000,
  });
}