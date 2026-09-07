import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPlans,
  getCurrentSubscription,
  createPendingSubscription,
  getCurrentPlanData,
  getActionPacks,
  purchaseActionPack,
  getCreditLedger,
} from "./api";

const PLANS_KEY = ["billing-plans"] as const;
const SUB_KEY = ["billing-subscription"] as const;

export function useBillingPlans() {
  return useQuery({
    queryKey: PLANS_KEY,
    queryFn: getPlans,
    staleTime: 60_000,
  });
}

export function useBillingSubscription(businessId: string | undefined) {
  return useQuery({
    queryKey: [...SUB_KEY, businessId],
    queryFn: () => getCurrentSubscription(businessId as string),
    enabled: Boolean(businessId),
    staleTime: 60_000,
  });
}

export function useBillingPlanData(businessId: string | undefined) {
  return useQuery({
    queryKey: ["billing-plan-data", businessId],
    queryFn: () => getCurrentPlanData(businessId as string),
    enabled: Boolean(businessId),
    staleTime: 60_000,
  });
}

export function useCreatePendingSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ businessId, planId, referenceNumber }: { businessId: string; planId: string; referenceNumber: string }) =>
      createPendingSubscription(businessId, planId, referenceNumber),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUB_KEY });
      qc.invalidateQueries({ queryKey: ["billing-plan-data"] });
    },
  });
}

export function useActionPacks() {
  return useQuery({
    queryKey: ["action-packs"],
    queryFn: getActionPacks,
    staleTime: 60_000,
  });
}

export function usePurchaseActionPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ businessId, packSku }: { businessId: string; packSku: string }) =>
      purchaseActionPack(businessId, packSku),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUB_KEY });
      qc.invalidateQueries({ queryKey: ["billing-plan-data"] });
    },
  });
}

export function useCreditLedger(businessId: string | undefined) {
  return useQuery({
    queryKey: ["credit-ledger", businessId],
    queryFn: () => getCreditLedger(businessId as string),
    enabled: Boolean(businessId),
    staleTime: 60_000,
  });
}