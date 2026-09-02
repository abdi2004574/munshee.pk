export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          tenant_id: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      app_settings: {
        Row: {
          tenant_id: string;
          locale: string;
          currency: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          tenant_id: string;
          locale?: string;
          currency?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tenant_id?: string;
          locale?: string;
          currency?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

export type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
export type TenantInsert = Database["public"]["Tables"]["tenants"]["Insert"];
export type TenantUpdate = Database["public"]["Tables"]["tenants"]["Update"];

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type AppSettings = Database["public"]["Tables"]["app_settings"]["Row"];
export type AppSettingsInsert = Database["public"]["Tables"]["app_settings"]["Insert"];
export type AppSettingsUpdate = Database["public"]["Tables"]["app_settings"]["Update"];

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue | undefined }
  | JsonValue[];

export interface Product {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  brand: string | null;
  status: "active" | "draft" | "archived";
  tags: string[];
  weight_grams: number | null;
  slug: string | null;
  metadata: Record<string, JsonValue> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ProductInsert = Omit<Product, "id" | "created_at" | "updated_at" | "deleted_at"> &
  Partial<Pick<Product, "id" | "created_at" | "updated_at" | "deleted_at">>;

export type ProductUpdate = Partial<ProductInsert>;

export interface ProductVariant {
  id: string;
  tenant_id: string;
  product_id: string;
  sku: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  barcode: string | null;
  options: Record<string, JsonValue>;
  status: "active" | "draft" | "archived";
  currency: string;
  metadata: Record<string, JsonValue> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ProductVariantInsert = Omit<
  ProductVariant,
  "id" | "created_at" | "updated_at" | "deleted_at"
> &
  Partial<Pick<ProductVariant, "id" | "created_at" | "updated_at" | "deleted_at">>;

export type ProductVariantUpdate = Partial<ProductVariantInsert>;

export interface InventoryLevel {
  id: string;
  tenant_id: string;
  variant_id: string;
  location: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  reorder_point: number;
  metadata: Record<string, JsonValue> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type InventoryLevelInsert = Omit<
  InventoryLevel,
  "id" | "created_at" | "updated_at" | "deleted_at"
> &
  Partial<Pick<InventoryLevel, "id" | "created_at" | "updated_at" | "deleted_at">>;

export type InventoryLevelUpdate = Partial<InventoryLevelInsert>;

export interface Customer {
  id: string;
  tenant_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  tags: string[];
  metadata: Record<string, JsonValue> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type CustomerInsert = Omit<Customer, "id" | "created_at" | "updated_at" | "deleted_at"> &
  Partial<Pick<Customer, "id" | "created_at" | "updated_at" | "deleted_at">>;

export type CustomerUpdate = Partial<CustomerInsert>;

export interface Order {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  order_number: string;
  status: string;
  currency: string;
  subtotal: number;
  tax_total: number;
  shipping_total: number;
  discount_total: number;
  grand_total: number;
  shipping_address: Record<string, JsonValue> | null;
  billing_address: Record<string, JsonValue> | null;
  metadata: Record<string, JsonValue> | null;
  placed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type OrderInsert = Omit<Order, "id" | "created_at" | "updated_at" | "deleted_at"> &
  Partial<Pick<Order, "id" | "created_at" | "updated_at" | "deleted_at">>;

export type OrderUpdate = Partial<OrderInsert>;

export interface OrderItem {
  id: string;
  tenant_id: string;
  order_id: string;
  variant_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  metadata: Record<string, JsonValue> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type OrderItemInsert = Omit<
  OrderItem,
  "id" | "created_at" | "updated_at" | "deleted_at"
> &
  Partial<Pick<OrderItem, "id" | "created_at" | "updated_at" | "deleted_at">>;

export type OrderItemUpdate = Partial<OrderItemInsert>;