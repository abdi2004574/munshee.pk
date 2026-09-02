import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCustomer,
  getCustomer,
  listCustomers,
  softDeleteCustomer,
  updateCustomer,
  type ListCustomersFilters,
  type ListCustomersPagination,
} from "./api";

const CUSTOMERS_KEY = ["customers"] as const;

export function useCustomers(
  filters: ListCustomersFilters = {},
  pagination: ListCustomersPagination = { from: 0, to: 24 },
) {
  return useQuery({
    queryKey: [...CUSTOMERS_KEY, filters, pagination] as const,
    queryFn: () => listCustomers(filters, pagination),
    staleTime: 30_000,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["customer", id] as const,
    queryFn: () => getCustomer(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createCustomer>[0]) => createCustomer(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CUSTOMERS_KEY });
    },
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateCustomer>[1] }) =>
      updateCustomer(id, data),
    onSuccess: (_customer, { id }) => {
      qc.invalidateQueries({ queryKey: ["customer", id] });
      qc.invalidateQueries({ queryKey: CUSTOMERS_KEY });
    },
  });
}

export function useSoftDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteCustomer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CUSTOMERS_KEY });
    },
  });
}
