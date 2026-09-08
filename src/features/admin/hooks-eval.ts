import { useQuery } from "@tanstack/react-query";
import { getEvalWeekly, type EvalWeeklyRow } from "./api-eval";

const EVAL_KEY = ["admin-eval-weekly"] as const;

export function useEvalWeekly() {
  return useQuery<EvalWeeklyRow[]>({
    queryKey: EVAL_KEY,
    queryFn: getEvalWeekly,
    staleTime: 60_000,
  });
}
