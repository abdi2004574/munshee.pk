import { supabase } from "@/lib/supabase";
import type {
  Product,
  ProductInsert,
  ProductUpdate,
  ProductVariant,
} from "@/lib/types";

export interface ListProductsFilters {
  status?: string;
  category?: string;
  search?: string;
}

export interface ListProductsPagination {
  from: number;
  to: number;
}

export interface ProductWithVariants extends Product {
  product_variants: ProductVariant[];
}

export async function listProducts(
  filters: ListProductsFilters = {},
  pagination: ListProductsPagination = { from: 0, to: 24 },
): Promise<Product[]> {
  let query = supabase
    .from("products" as never)
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(pagination.from, pagination.to);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.category) {
    query = query.eq("category", filters.category);
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`name.ilike.${term},sku.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Product[];
}

export async function getProduct(id: string): Promise<ProductWithVariants | null> {
  const { data, error } = await supabase
    .from("products" as never)
    .select("*, product_variants!product_variants_product_id_fkey(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const variants = (data as { product_variants?: ProductVariant[] }).product_variants ?? [];
  const filtered = variants.filter((v) => v.deleted_at === null);
  return { ...(data as unknown as Product), product_variants: filtered };
}

export async function createProduct(data: ProductInsert): Promise<Product> {
  const { data: created, error } = await supabase
    .from("products" as never)
    .insert(data as never)
    .select("*")
    .single();
  if (error) throw error;
  return created as unknown as Product;
}

export async function updateProduct(id: string, data: ProductUpdate): Promise<Product> {
  const { data: updated, error } = await supabase
    .from("products" as never)
    .update(data as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return updated as unknown as Product;
}

export async function softDeleteProduct(id: string): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_commerce_row" as never, {
    p_table: "products",
    p_id: id,
  } as never);
  if (error) throw error;
}