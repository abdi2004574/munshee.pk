import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  initiateSocialConnect,
  listSocialConnections,
  revokeSocialConnection,
} from "./api";

const SOCIAL_KEY = ["social-connections"] as const;

export function useSocialConnections() {
  return useQuery({
    queryKey: SOCIAL_KEY,
    queryFn: () => listSocialConnections(),
    staleTime: 60_000,
  });
}

export function useInitiateSocialConnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ provider }: { provider: "facebook" | "instagram" }) =>
      initiateSocialConnect(provider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SOCIAL_KEY });
    },
  });
}

export function useRevokeSocialConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeSocialConnection(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SOCIAL_KEY });
    },
  });
}
