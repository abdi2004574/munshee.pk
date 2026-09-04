import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  claimFreeCredits,
  getCreditLedger,
  getCurrentCreditBalance,
  getSubscriptionPlans,
  initiatePayment,
} from "./api";

export function useCreditBalance() {
  return useQuery({
    queryKey: ["creditBalance"],
    queryFn: getCurrentCreditBalance,
    staleTime: 30_000,
  });
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ["subscriptionPlans"],
    queryFn: getSubscriptionPlans,
    staleTime: 60_000,
  });
}

export function useCreditLedger() {
  return useQuery({
    queryKey: ["creditLedger"],
    queryFn: getCreditLedger,
    staleTime: 30_000,
  });
}

export function useClaimFreeCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: claimFreeCredits,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["creditBalance"] });
      qc.invalidateQueries({ queryKey: ["creditLedger"] });
    },
  });
}

export function useInitiatePayment() {
  return useMutation({
    mutationFn: ({ provider, planId }: { provider: "jazzcash" | "easypaisa"; planId: string }) =>
      initiatePayment(provider, planId),
  });
}