import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPendingPayments, activateSubscription } from "./api";

const PENDING_KEY = ["admin-pending-payments"] as const;

export function usePendingPayments() {
  return useQuery({
    queryKey: PENDING_KEY,
    queryFn: getPendingPayments,
    staleTime: 60_000,
  });
}

export function useActivateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subscriptionId, planId }: { subscriptionId: string; planId: string }) =>
      activateSubscription(subscriptionId, planId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PENDING_KEY });
    },
  });
}
