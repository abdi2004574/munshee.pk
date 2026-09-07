import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getCurrentPlan,
  getPlans,
  consumeAction,
  getManagedBusinesses,
  getActiveBusiness,
  setActiveBusiness,
  isAdmin,
  createClientBusiness,
} from "@/lib/plans-service";
import { useSession } from "@/features/auth/useSession";

const PLAN_KEY = ["plan"] as const;
const PLANS_KEY = ["plans"] as const;
const MANAGED_BUSINESSES_KEY = ["managed-businesses"] as const;
const ADMIN_KEY = ["admin-mode"] as const;

export function usePlan(businessId?: string) {
  return useQuery({
    queryKey: [...PLAN_KEY, businessId ?? null],
    queryFn: () => getCurrentPlan(businessId),
    staleTime: 60_000,
    enabled: true,
  });
}

export function usePlans() {
  return useQuery({
    queryKey: PLANS_KEY,
    queryFn: () => getPlans(),
    staleTime: 60_000,
  });
}

export function useConsumeAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      businessId,
      reason,
      model,
    }: {
      businessId: string;
      reason: string;
      model?: string;
    }) => consumeAction(businessId, reason, model),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLAN_KEY });
    },
  });
}

export function useManagedBusinesses() {
  return useQuery({
    queryKey: MANAGED_BUSINESSES_KEY,
    queryFn: () => getManagedBusinesses(),
    staleTime: 60_000,
  });
}

export function useExpertClients() {
  return useManagedBusinesses();
}

export function useActiveBusiness() {
  const { data: sessionData, isLoading: sessionLoading } = useSession();
  const [businessId, setBusinessIdState] = useState<string>(() => {
    const stored = getActiveBusiness();
    return stored;
  });

  useEffect(() => {
    if (!sessionLoading && sessionData?.session?.user?.id) {
      const stored = getActiveBusiness();
      if (!stored) {
        setBusinessIdState(sessionData.session.user.id);
        setActiveBusiness(sessionData.session.user.id);
      }
    }
  }, [sessionData, sessionLoading]);

  const setBusinessId = (id: string) => {
    setBusinessIdState(id);
    setActiveBusiness(id);
  };

  return { businessId, setBusinessId, isLoading: sessionLoading };
}

export function useAdminMode() {
  return useQuery({
    queryKey: ADMIN_KEY,
    queryFn: () => isAdmin(),
    staleTime: 60_000,
  });
}

export function useCreateClientBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, phone }: { name: string; phone?: string }) =>
      createClientBusiness(name, phone),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MANAGED_BUSINESSES_KEY });
    },
  });
}