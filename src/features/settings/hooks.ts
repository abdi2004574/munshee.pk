import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTenant,
  updateTenant,
  getAppSettings,
  updateAppSettings,
} from "./api";
import type { TenantUpdate, AppSettingsUpdate } from "@/lib/types";

const TENANT_KEY = ["tenant"] as const;

export function useTenant() {
  return useQuery({
    queryKey: TENANT_KEY,
    queryFn: getTenant,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TenantUpdate) => updateTenant(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TENANT_KEY });
    },
  });
}

const APP_SETTINGS_KEY = ["app-settings"] as const;

export function useAppSettings() {
  return useQuery({
    queryKey: APP_SETTINGS_KEY,
    queryFn: getAppSettings,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateAppSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AppSettingsUpdate) => updateAppSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: APP_SETTINGS_KEY });
    },
  });
}
