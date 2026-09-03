import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeAskMunshee } from "./api";

const ASK_KEY = ["ask-munshee"] as const;

export function useAskMunshee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, question }: { tenantId: string; question: string }) =>
      invokeAskMunshee(tenantId, question),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ASK_KEY });
    },
  });
}
