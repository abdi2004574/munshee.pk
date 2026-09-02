import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adjustInventory, listInventory, type AdjustInventoryInput } from "./api";

export function useInventory(variantId?: string) {
  return useQuery({
    queryKey: variantId ? ["inventory", { variantId }] : ["inventory"],
    queryFn: () => listInventory(variantId),
    staleTime: 30_000,
  });
}

export function useAdjustInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdjustInventoryInput) => adjustInventory(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["product"] });
    },
  });
}
