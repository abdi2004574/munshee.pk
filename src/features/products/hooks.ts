import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProduct,
  getProduct,
  listProducts,
  softDeleteProduct,
  updateProduct,
  type ListProductsFilters,
  type ListProductsPagination,
} from "./api";
import { supabase } from "@/lib/supabase";
import type { ProductInsert, ProductVariant, ProductVariantInsert } from "@/lib/types";

const PRODUCTS_KEY = ["products"] as const;

export function useProducts(
  filters: ListProductsFilters = {},
  pagination: ListProductsPagination = { from: 0, to: 24 },
) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, filters, pagination] as const,
    queryFn: () => listProducts(filters, pagination),
    staleTime: 30_000,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["product", id] as const,
    queryFn: () => getProduct(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductInsert) => createProduct(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateProduct>[1] }) =>
      updateProduct(id, data),
    onSuccess: (_product, { id }) => {
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
      qc.invalidateQueries({ queryKey: ["product", id] });
    },
  });
}

export function useSoftDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
  });
}

export function useCreateVariant(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<ProductVariantInsert, "product_id" | "tenant_id">) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const tenantId = sessionData.session?.user.id;
      if (!tenantId) throw new Error("Not authenticated");
      const { data: created, error } = await supabase
        .from("product_variants" as never)
        .insert({ ...data, product_id: productId, tenant_id: tenantId } as never)
        .select("*")
        .single();
      if (error) throw error;
      return created as unknown as ProductVariant;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product", productId] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}