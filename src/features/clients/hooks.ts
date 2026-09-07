import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getManagedBusinesses, createClientBusiness } from "./api";

const MANAGED_KEY = ["managed-businesses"] as const;

export function useManagedBusinesses() {
  return useQuery({
    queryKey: MANAGED_KEY,
    queryFn: getManagedBusinesses,
    staleTime: 60_000,
  });
}

export function useCreateClientBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, phone }: { name: string; phone?: string }) =>
      createClientBusiness(name, phone),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MANAGED_KEY });
    },
  });
}
