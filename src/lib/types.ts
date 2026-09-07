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
          credit_balance: number;
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
      businesses: {
        Row: {
          id: string;
          tenant_id: string;
          slug: string;
          display_name: string;
          description: string | null;
          views_count: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          slug: string;
          display_name: string;
          description?: string | null;
          views_count?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          slug?: string;
          display_name?: string;
          description?: string | null;
          views_count?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      business_facts: {
        Row: {
          id: string;
          tenant_id: string;
          category: string;
          label: string;
          value: string;
          confidence: number | null;
          status: string;
          source_type: string;
          source_ref: string | null;
          linked_table: string | null;
          linked_row_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          category: string;
          label: string;
          value: string;
          confidence?: number | null;
          status?: string;
          source_type: string;
          source_ref?: string | null;
          linked_table?: string | null;
          linked_row_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          category?: string;
          label?: string;
          value?: string;
          confidence?: number | null;
          status?: string;
          source_type?: string;
          source_ref?: string | null;
          linked_table?: string | null;
          linked_row_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      audit_log: {
        Row: {
          id: string;
          tenant_id: string;
          fact_id: string | null;
          actor: string;
          action: string;
          old_value: Record<string, unknown> | null;
          new_value: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          fact_id?: string | null;
          actor: string;
          action: string;
          old_value?: Record<string, unknown> | null;
          new_value?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          fact_id?: string | null;
          actor?: string;
          action?: string;
          old_value?: Record<string, unknown> | null;
          new_value?: Record<string, unknown> | null;
          created_at?: string;
        };
      };
      ask_logs: {
        Row: {
          id: string;
          tenant_id: string;
          question: string;
          answer: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          question: string;
          answer: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          question?: string;
          answer?: string;
          created_at?: string;
        };
      };

      social_connections: {
        Row: {
          id: string;
          tenant_id: string;
          provider: string;
          page_id: string;
          page_name: string | null;
          access_token: string;
          token_expires_at: string | null;
          last_sync_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          provider: string;
          page_id: string;
          page_name?: string | null;
          access_token: string;
          token_expires_at?: string | null;
          last_sync_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          provider?: string;
          page_id?: string;
          page_name?: string | null;
          access_token?: string;
          token_expires_at?: string | null;
          last_sync_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };

      action_ledger: {
        Row: {
          id: string;
          business_id: string;
          actor_type: string;
          tool_name: string;
          input_summary: string;
          result_summary: string;
          status: string;
          autonomy_level: number;
          estimated_value_pkr: number;
          reversible: boolean;
          created_at: string;
        };
        Insert: {
          business_id: string;
          actor_type: string;
          tool_name: string;
          input_summary: string;
          result_summary: string;
          status: string;
          autonomy_level?: number;
          estimated_value_pkr?: number;
          reversible?: boolean;
        };
        Update: {
          actor_type?: string;
          tool_name?: string;
          input_summary?: string;
          result_summary?: string;
          status?: string;
          autonomy_level?: number;
          estimated_value_pkr?: number;
          reversible?: boolean;
        };
      };
      autonomy_settings: {
        Row: {
          id: string;
          business_id: string;
          action_type: string;
          level: number;
          auto_approve: boolean;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          action_type: string;
          level?: number;
          auto_approve?: boolean;
        };
        Update: {
          level?: number;
          auto_approve?: boolean;
        };
      };
      kill_switch: {
        Row: {
          id: string;
          business_id: string;
          scope: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          business_id: string;
          scope: string;
          active?: boolean;
        };
        Update: {
          scope?: string;
          active?: boolean;
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

export interface ImportBatch {
  id: string;
  tenant_id: string;
  file_name: string;
  table_name: "products" | "product_variants" | "customers" | "inventory_levels";
  total_rows: number;
  processed_rows: number;
  status: "pending" | "processing" | "review" | "completed" | "failed";
  error_log: Record<string, JsonValue> | null;
  created_at: string;
  updated_at: string;
}

export type ImportBatchInsert = Omit<ImportBatch, "id" | "created_at" | "updated_at"> &
  Partial<Pick<ImportBatch, "id" | "created_at" | "updated_at">>;

export interface ImportQueueItem {
  id: string;
  tenant_id: string;
  batch_id: string;
  table_name: string;
  payload: Record<string, JsonValue>;
  source_type: string;
  confidence_score: number | null;
  verbatim_quote: string | null;
  needs_review: boolean;
  reviewed_at: string | null;
  status: "pending" | "approved" | "rejected" | "error";
  error_message: string | null;
  target_row_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ImportQueueItemInsert = Omit<
  ImportQueueItem,
  "id" | "created_at" | "updated_at"
> &
  Partial<Pick<ImportQueueItem, "id" | "created_at" | "updated_at">>;

export type Business = Database["public"]["Tables"]["businesses"]["Row"];
export type BusinessInsert = Database["public"]["Tables"]["businesses"]["Insert"];
export type BusinessUpdate = Database["public"]["Tables"]["businesses"]["Update"];

export type BusinessFact = Database["public"]["Tables"]["business_facts"]["Row"];
export type BusinessFactInsert = Database["public"]["Tables"]["business_facts"]["Insert"];
export type BusinessFactUpdate = Database["public"]["Tables"]["business_facts"]["Update"];

export type AuditLog = Database["public"]["Tables"]["audit_log"]["Row"];
export type AskLog = Database["public"]["Tables"]["ask_logs"]["Row"];

export type SocialConnection = Database["public"]["Tables"]["social_connections"]["Row"];
export type SocialConnectionInsert = Database["public"]["Tables"]["social_connections"]["Insert"];
export type SocialConnectionUpdate = Database["public"]["Tables"]["social_connections"]["Update"];


export type ActionLedger = Database["public"]["Tables"]["action_ledger"]["Row"];
export type ActionLedgerInsert = Database["public"]["Tables"]["action_ledger"]["Insert"];
export type ActionLedgerUpdate = Database["public"]["Tables"]["action_ledger"]["Update"];

export type AutonomySettings = Database["public"]["Tables"]["autonomy_settings"]["Row"];
export type AutonomySettingsInsert = Database["public"]["Tables"]["autonomy_settings"]["Insert"];
export type AutonomySettingsUpdate = Database["public"]["Tables"]["autonomy_settings"]["Update"];

export type KillSwitch = Database["public"]["Tables"]["kill_switch"]["Row"];
export type KillSwitchInsert = Database["public"]["Tables"]["kill_switch"]["Insert"];
export type KillSwitchUpdate = Database["public"]["Tables"]["kill_switch"]["Update"];