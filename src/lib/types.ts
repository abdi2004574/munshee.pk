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
