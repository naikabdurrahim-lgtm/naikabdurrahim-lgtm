/**
 * Database types for the Supabase schema in `supabase/migrations`.
 *
 * GENERATED FILE — do not edit by hand. Regenerate with:
 *
 *     python3 scripts/generate-types.py <postgres-dsn>
 *
 * or, with the Supabase CLI linked to a project:
 *
 *     npm run db:types
 *
 * Generated columns (totals, invoice number, search vector) appear in Row
 * only: the client can never write them.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          tenant_id: string;
          allow_negative_stock: boolean;
          low_stock_alert_qty: number;
          default_unit: string;
          receipt_header: string | null;
          receipt_footer: string;
          show_profit_to_manager: boolean;
          allow_cashier_discount: boolean;
          updated_at: string;
        };
        Insert: {
          tenant_id: string;
          allow_negative_stock?: boolean;
          low_stock_alert_qty?: number;
          default_unit?: string;
          receipt_header?: string | null;
          receipt_footer?: string;
          show_profit_to_manager?: boolean;
          allow_cashier_discount?: boolean;
          updated_at?: string;
        };
        Update: {
          tenant_id?: string;
          allow_negative_stock?: boolean;
          low_stock_alert_qty?: number;
          default_unit?: string;
          receipt_header?: string | null;
          receipt_footer?: string;
          show_profit_to_manager?: boolean;
          allow_cashier_discount?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'app_settings_default_unit_fkey';
            columns: ['default_unit'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'app_settings_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          tenant_id: string;
          actor_id: string | null;
          action: string;
          entity_table: string;
          entity_id: string | null;
          before_data: Json | null;
          after_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          actor_id?: string | null;
          action: string;
          entity_table: string;
          entity_id?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          actor_id?: string | null;
          action?: string;
          entity_table?: string;
          entity_id?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      auth_attempts: {
        Row: {
          id: string;
          phone_hash: string;
          success: boolean;
          ip_hash: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          phone_hash: string;
          success: boolean;
          ip_hash?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          phone_hash?: string;
          success?: boolean;
          ip_hash?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          name_en: string | null;
          icon: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          name_en?: string | null;
          icon?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          name_en?: string | null;
          icon?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          phone: string | null;
          address: string | null;
          note: string | null;
          credit_limit_paisa: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          phone?: string | null;
          address?: string | null;
          note?: string | null;
          credit_limit_paisa?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          phone?: string | null;
          address?: string | null;
          note?: string | null;
          credit_limit_paisa?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      ledger_entries: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          entry_type: Database['public']['Enums']['ledger_entry_type'];
          amount_paisa: number;
          sale_id: string | null;
          payment_id: string | null;
          note: string | null;
          occurred_at: string;
          created_at: string;
          created_by: string | null;
          client_id: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          customer_id: string;
          entry_type: Database['public']['Enums']['ledger_entry_type'];
          amount_paisa: number;
          sale_id?: string | null;
          payment_id?: string | null;
          note?: string | null;
          occurred_at?: string;
          created_at?: string;
          created_by?: string | null;
          client_id: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_id?: string;
          entry_type?: Database['public']['Enums']['ledger_entry_type'];
          amount_paisa?: number;
          sale_id?: string | null;
          payment_id?: string | null;
          note?: string | null;
          occurred_at?: string;
          created_at?: string;
          created_by?: string | null;
          client_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ledger_entries_customer_fkey';
            columns: ['tenant_id', 'customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'ledger_entries_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          sale_id: string | null;
          customer_id: string | null;
          amount_paisa: number;
          method: Database['public']['Enums']['payment_method'];
          reference: string | null;
          note: string | null;
          received_at: string;
          created_at: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          sale_id?: string | null;
          customer_id?: string | null;
          amount_paisa: number;
          method?: Database['public']['Enums']['payment_method'];
          reference?: string | null;
          note?: string | null;
          received_at?: string;
          created_at?: string;
          created_by?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          client_id?: string;
          sale_id?: string | null;
          customer_id?: string | null;
          amount_paisa?: number;
          method?: Database['public']['Enums']['payment_method'];
          reference?: string | null;
          note?: string | null;
          received_at?: string;
          created_at?: string;
          created_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_customer_fkey';
            columns: ['tenant_id', 'customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'payments_sale_fkey';
            columns: ['tenant_id', 'sale_id'];
            isOneToOne: false;
            referencedRelation: 'sales';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'payments_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      product_batches: {
        Row: {
          id: string;
          tenant_id: string;
          product_id: string;
          variant_id: string | null;
          batch_no: string;
          expiry_date: string | null;
          buy_price_paisa: number;
          qty_received: number;
          qty_remaining: number;
          supplier_id: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          product_id: string;
          variant_id?: string | null;
          batch_no: string;
          expiry_date?: string | null;
          buy_price_paisa?: number;
          qty_received?: number;
          qty_remaining?: number;
          supplier_id?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          product_id?: string;
          variant_id?: string | null;
          batch_no?: string;
          expiry_date?: string | null;
          buy_price_paisa?: number;
          qty_received?: number;
          qty_remaining?: number;
          supplier_id?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'product_batches_product_fkey';
            columns: ['tenant_id', 'product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'product_batches_supplier_fkey';
            columns: ['tenant_id', 'supplier_id'];
            isOneToOne: false;
            referencedRelation: 'suppliers';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'product_batches_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_batches_variant_fkey';
            columns: ['tenant_id', 'variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['tenant_id', 'id'];
          },
        ];
      };
      product_variants: {
        Row: {
          id: string;
          tenant_id: string;
          product_id: string;
          name: string;
          sku: string | null;
          barcode: string | null;
          buy_price_paisa: number | null;
          sell_price_paisa: number | null;
          stock_qty: number;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          product_id: string;
          name: string;
          sku?: string | null;
          barcode?: string | null;
          buy_price_paisa?: number | null;
          sell_price_paisa?: number | null;
          stock_qty?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          product_id?: string;
          name?: string;
          sku?: string | null;
          barcode?: string | null;
          buy_price_paisa?: number | null;
          sell_price_paisa?: number | null;
          stock_qty?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'product_variants_product_fkey';
            columns: ['tenant_id', 'product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'product_variants_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          tenant_id: string;
          category_id: string | null;
          name: string;
          name_en: string | null;
          barcode: string | null;
          sku: string | null;
          unit_code: string;
          buy_price_paisa: number;
          sell_price_paisa: number;
          wholesale_price_paisa: number | null;
          stock_qty: number;
          stock_alert_qty: number;
          is_service: boolean;
          image_path: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          deleted_at: string | null;
          search_vector: unknown | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          category_id?: string | null;
          name: string;
          name_en?: string | null;
          barcode?: string | null;
          sku?: string | null;
          unit_code?: string;
          buy_price_paisa?: number;
          sell_price_paisa: number;
          wholesale_price_paisa?: number | null;
          stock_qty?: number;
          stock_alert_qty?: number;
          is_service?: boolean;
          image_path?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          category_id?: string | null;
          name?: string;
          name_en?: string | null;
          barcode?: string | null;
          sku?: string | null;
          unit_code?: string;
          buy_price_paisa?: number;
          sell_price_paisa?: number;
          wholesale_price_paisa?: number | null;
          stock_qty?: number;
          stock_alert_qty?: number;
          is_service?: boolean;
          image_path?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'products_category_fkey';
            columns: ['tenant_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'products_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'products_unit_code_fkey';
            columns: ['unit_code'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['code'];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          avatar_path: string | null;
          locale: string;
          numeral_style: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          full_name?: string;
          phone?: string | null;
          avatar_path?: string | null;
          locale?: string;
          numeral_style?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          avatar_path?: string | null;
          locale?: string;
          numeral_style?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: false;
            referencedRelation: 'auth.users';
            referencedColumns: ['id'];
          },
        ];
      };
      recovery_codes: {
        Row: {
          id: string;
          user_id: string;
          code_hash: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          code_hash: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          code_hash?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recovery_codes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'auth.users';
            referencedColumns: ['id'];
          },
        ];
      };
      sale_items: {
        Row: {
          id: string;
          tenant_id: string;
          sale_id: string;
          product_id: string | null;
          variant_id: string | null;
          batch_id: string | null;
          name_snapshot: string;
          unit_code: string;
          qty: number;
          unit_price_paisa: number;
          cost_price_paisa: number;
          discount_paisa: number;
          line_total_paisa: number;
          sort_order: number;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          sale_id: string;
          product_id?: string | null;
          variant_id?: string | null;
          batch_id?: string | null;
          name_snapshot: string;
          unit_code?: string;
          qty: number;
          unit_price_paisa: number;
          cost_price_paisa?: number;
          discount_paisa?: number;
          line_total_paisa?: number;
          sort_order?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          sale_id?: string;
          product_id?: string | null;
          variant_id?: string | null;
          batch_id?: string | null;
          name_snapshot?: string;
          unit_code?: string;
          qty?: number;
          unit_price_paisa?: number;
          cost_price_paisa?: number;
          discount_paisa?: number;
          line_total_paisa?: number;
          sort_order?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'sale_items_batch_fkey';
            columns: ['tenant_id', 'batch_id'];
            isOneToOne: false;
            referencedRelation: 'product_batches';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'sale_items_sale_fkey';
            columns: ['tenant_id', 'sale_id'];
            isOneToOne: false;
            referencedRelation: 'sales';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'sale_items_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sale_items_variant_fkey';
            columns: ['tenant_id', 'variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['tenant_id', 'id'];
          },
        ];
      };
      sales: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          invoice_seq: number | null;
          invoice_no: string | null;
          customer_id: string | null;
          status: Database['public']['Enums']['sale_status'];
          business_date: string;
          subtotal_paisa: number;
          discount_paisa: number;
          discount_kind: string;
          total_paisa: number | null;
          paid_paisa: number;
          due_paisa: number | null;
          note: string | null;
          device_id: string | null;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
          created_at: string;
          updated_at: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          invoice_seq?: number | null;
          customer_id?: string | null;
          status?: Database['public']['Enums']['sale_status'];
          business_date?: string;
          subtotal_paisa: number;
          discount_paisa?: number;
          discount_kind?: string;
          paid_paisa?: number;
          note?: string | null;
          device_id?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          client_id?: string;
          invoice_seq?: number | null;
          customer_id?: string | null;
          status?: Database['public']['Enums']['sale_status'];
          business_date?: string;
          subtotal_paisa?: number;
          discount_paisa?: number;
          discount_kind?: string;
          paid_paisa?: number;
          note?: string | null;
          device_id?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sales_customer_fkey';
            columns: ['tenant_id', 'customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'sales_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      stock_movements: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          product_id: string;
          variant_id: string | null;
          batch_id: string | null;
          movement_type: Database['public']['Enums']['stock_movement_type'];
          qty_delta: number;
          unit_cost_paisa: number;
          reason: string | null;
          reference_type: string | null;
          reference_id: string | null;
          occurred_at: string;
          created_at: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          product_id: string;
          variant_id?: string | null;
          batch_id?: string | null;
          movement_type: Database['public']['Enums']['stock_movement_type'];
          qty_delta: number;
          unit_cost_paisa?: number;
          reason?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
          occurred_at?: string;
          created_at?: string;
          created_by?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          client_id?: string;
          product_id?: string;
          variant_id?: string | null;
          batch_id?: string | null;
          movement_type?: Database['public']['Enums']['stock_movement_type'];
          qty_delta?: number;
          unit_cost_paisa?: number;
          reason?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
          occurred_at?: string;
          created_at?: string;
          created_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_movements_batch_fkey';
            columns: ['tenant_id', 'batch_id'];
            isOneToOne: false;
            referencedRelation: 'product_batches';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'stock_movements_product_fkey';
            columns: ['tenant_id', 'product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'stock_movements_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_movements_variant_fkey';
            columns: ['tenant_id', 'variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['tenant_id', 'id'];
          },
        ];
      };
      suppliers: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          phone: string | null;
          address: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          phone?: string | null;
          address?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          phone?: string | null;
          address?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'suppliers_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      sync_events: {
        Row: {
          id: string;
          tenant_id: string;
          device_id: string;
          direction: string;
          table_name: string;
          row_count: number;
          client_at: string | null;
          meta: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          device_id: string;
          direction: string;
          table_name: string;
          row_count?: number;
          client_at?: string | null;
          meta?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          device_id?: string;
          direction?: string;
          table_name?: string;
          row_count?: number;
          client_at?: string | null;
          meta?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sync_events_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_members: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: Database['public']['Enums']['member_role'];
          display_name: string | null;
          is_active: boolean;
          invited_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          role?: Database['public']['Enums']['member_role'];
          display_name?: string | null;
          is_active?: boolean;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          role?: Database['public']['Enums']['member_role'];
          display_name?: string | null;
          is_active?: boolean;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_members_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'auth.users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_members_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'auth.users';
            referencedColumns: ['id'];
          },
        ];
      };
      tenants: {
        Row: {
          id: string;
          name: string;
          pack: Database['public']['Enums']['business_pack'];
          owner_id: string;
          currency: string;
          timezone: string;
          locale: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          pack?: Database['public']['Enums']['business_pack'];
          owner_id: string;
          currency?: string;
          timezone?: string;
          locale?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          pack?: Database['public']['Enums']['business_pack'];
          owner_id?: string;
          currency?: string;
          timezone?: string;
          locale?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tenants_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'auth.users';
            referencedColumns: ['id'];
          },
        ];
      };
      units: {
        Row: {
          code: string;
          label_bn: string;
          label_en: string;
          kind: string;
          allows_decimal: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          code: string;
          label_bn: string;
          label_en: string;
          kind: string;
          allows_decimal?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          code?: string;
          label_bn?: string;
          label_en?: string;
          kind?: string;
          allows_decimal?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_customer_balances: {
        Row: {
          tenant_id: string;
          customer_id: string;
          name: string;
          phone: string;
          credit_limit_paisa: number;
          due_paisa: number;
          last_activity_at: string;
        };
        Relationships: [];
      };
      v_daily_summary: {
        Row: {
          tenant_id: string;
          business_date: string;
          sale_count: number;
          sales_paisa: number;
          credit_given_paisa: number;
          profit_paisa: number;
        };
        Relationships: [];
      };
      v_sale_items_receipt: {
        Row: {
          tenant_id: string;
          sale_id: string;
          id: string;
          name_snapshot: string;
          unit_code: string;
          qty: number;
          unit_price_paisa: number;
          discount_paisa: number;
          line_total_paisa: number;
          sort_order: number;
        };
        Relationships: [];
      };
      v_stock_on_hand: {
        Row: {
          tenant_id: string;
          product_id: string;
          name: string;
          cached_qty: number;
          computed_qty: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      auth_lockout_state: {
        Args: {
          p_phone_hash: string;
        };
        Returns: Json;
      };
      collect_due: {
        Args: {
          p_tenant: string;
          p_payload: Json;
        };
        Returns: Json;
      };
      consume_recovery_code: {
        Args: {
          p_user: string;
          p_code_hash: string;
        };
        Returns: boolean;
      };
      create_sale: {
        Args: {
          p_tenant: string;
          p_payload: Json;
        };
        Returns: Json;
      };
      create_tenant: {
        Args: {
          p_name: string;
          p_pack?: Database['public']['Enums']['business_pack'];
          p_owner_display_name?: string;
        };
        Returns: Database['public']['Tables']['tenants']['Row'];
      };
      customer_balance: {
        Args: {
          p_tenant: string;
          p_customer: string;
        };
        Returns: number;
      };
      has_tenant_role: {
        Args: {
          p_tenant: string;
          p_roles: Json;
        };
        Returns: boolean;
      };
      is_phone_available: {
        Args: {
          p_phone: string;
        };
        Returns: boolean;
      };
      is_tenant_member: {
        Args: {
          p_tenant: string;
        };
        Returns: boolean;
      };
      is_tenant_owner: {
        Args: {
          p_tenant: string;
        };
        Returns: boolean;
      };
      list_categories: {
        Args: {
          p_tenant: string;
        };
        Returns: {
          id: string | null;
          name: string | null;
          name_en: string | null;
          icon: string | null;
          sort_order: number | null;
          is_active: boolean | null;
          product_count: number | null;
        }[];
      };
      purge_old_auth_attempts: {
        Args: {
          p_older_than?: Json;
        };
        Returns: number;
      };
      record_auth_attempt: {
        Args: {
          p_phone_hash: string;
          p_success: boolean;
          p_ip_hash?: string;
          p_user_agent?: string;
        };
        Returns: Json;
      };
      record_stock_movement: {
        Args: {
          p_tenant: string;
          p_payload: Json;
        };
        Returns: Json;
      };
      search_products: {
        Args: {
          p_tenant: string;
          p_query?: string;
          p_category?: string;
          p_limit?: number;
          p_offset?: number;
          p_include_inactive?: boolean;
          p_id?: string;
          p_low_stock?: boolean;
        };
        Returns: {
          id: string | null;
          name: string | null;
          name_en: string | null;
          category_id: string | null;
          category_name: string | null;
          unit_code: string | null;
          barcode: string | null;
          sku: string | null;
          sell_price_paisa: number | null;
          buy_price_paisa: number | null;
          wholesale_price_paisa: number | null;
          stock_qty: number | null;
          stock_alert_qty: number | null;
          is_service: boolean | null;
          is_active: boolean | null;
          updated_at: string | null;
        }[];
      };
      set_recovery_code: {
        Args: {
          p_code_hash: string;
        };
        Returns: undefined;
      };
      shares_tenant_with: {
        Args: {
          p_user: string;
        };
        Returns: boolean;
      };
      tenant_day_summary: {
        Args: {
          p_tenant: string;
          p_date?: string;
        };
        Returns: Json;
      };
      void_sale: {
        Args: {
          p_tenant: string;
          p_sale_id: string;
          p_reason: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      business_pack: 'grocery' | 'pharmacy' | 'clothing' | 'restaurant' | 'service' | 'general';
      ledger_entry_type: 'debit' | 'credit';
      member_role: 'owner' | 'manager' | 'cashier';
      payment_method: 'cash' | 'bkash' | 'nagad' | 'rocket' | 'card' | 'bank' | 'other';
      sale_status: 'completed' | 'voided';
      stock_movement_type:
        'opening' | 'purchase' | 'sale' | 'sale_return' | 'adjustment' | 'damage';
    };
    CompositeTypes: Record<string, never>;
  };
};
