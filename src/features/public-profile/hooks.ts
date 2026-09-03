import { useMutation, useQuery } from "@tanstack/react-query";
import { getPublicProfile, incrementViews } from "./api";

export function usePublicProfile(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["public-profile", tenantId],
    queryFn: () => getPublicProfile(tenantId as string),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });
}

export function useIncrementViews() {
  return useMutation({
    mutationFn: (tenantId: string) => incrementViews(tenantId),
  });
}
