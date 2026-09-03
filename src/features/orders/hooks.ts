import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOrderWithItems,
  getOrder,
  listOrders,
  softDeleteOrder,
  updateOrderStatus,
  type CreateOrderWithItemsParams,
  type ListOrdersFilters,
  type ListOrdersPagination,
} from "./api";

const ORDERS_KEY = ["orders"] as const;

export function useOrders(
  filters: ListOrdersFilters = {},
  pagination: ListOrdersPagination = { from: 0, to: 24 },
) {
  return useQuery({
    queryKey: [...ORDERS_KEY, filters, pagination] as const,
    queryFn: () => listOrders(filters, pagination),
    staleTime: 30_000,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["order", id] as const,
    queryFn: () => getOrder(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreateOrderWithItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateOrderWithItemsParams) => createOrderWithItems(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateOrderStatus(id, status),
    onSuccess: (_order, { id }) => {
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

export function useSoftDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}
