import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBusinessFactsBatch,
  listBusinessFacts,
  updateBusinessFact,
} from "./api";

const FACTS_KEY = ["business-facts"] as const;

export function useBusinessFacts(filters: {
  category?: string;
  status?: string;
} = {}) {
  return useQuery({
    queryKey: [...FACTS_KEY, filters] as const,
    queryFn: () => listBusinessFacts(filters),
    staleTime: 30_000,
  });
}

export function useCreateBusinessFacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (facts: Parameters<typeof createBusinessFactsBatch>[0]) =>
      createBusinessFactsBatch(facts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FACTS_KEY });
    },
  });
}

export function useUpdateBusinessFact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateBusinessFact>[1] }) =>
      updateBusinessFact(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FACTS_KEY });
    },
  });
}
