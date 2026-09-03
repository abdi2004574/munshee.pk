import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAuditLog } from "./api";

const AUDIT_LOG_KEY = ["audit-log"] as const;

export function useCreateAuditLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createAuditLog>[0]) =>
      createAuditLog(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AUDIT_LOG_KEY });
    },
  });
}
