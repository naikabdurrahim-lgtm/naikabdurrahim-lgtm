/**
 * Database types for the Supabase schema in `supabase/migrations`.
 *
 * Generated from the live schema so the shape always matches the migrations.
 * Regenerate after any schema change with:
 *
 *     npm run db:types        # needs the Supabase CLI and SUPABASE_PROJECT_ID
 *
 * Generated columns (totals, invoice number, search vector) appear in Row only:
 * they can never be written by the client.
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      tenants: {
        Row: {
          id: string;
          name: string;
          pack: Database['public']['Enums']['business_pack'];
          owner_id: string;
          currency: unknown;
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
          currency?: unknown;
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
          currency?: unknown;
          timezone?: string;
          locale?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
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
          phone: string | null;
          credit_limit_paisa: number | null;
          due_paisa: number;
          last_activity_at: string | null;
        };
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
      };
      v_stock_on_hand: {
        Row: {
          tenant_id: string;
          product_id: string;
          name: string;
          cached_qty: number;
          computed_qty: number;
        };
      };
    };
    Functions: {
      create_tenant: {
        Args: {
          p_name: string;
          p_pack?: Database['public']['Enums']['business_pack'];
          p_owner_display_name?: string | null;
        };
        Returns: Database['public']['Tables']['tenants']['Row'];
      };
      create_sale: { Args: { p_tenant: string; p_payload: Json }; Returns: Json };
      collect_due: { Args: { p_tenant: string; p_payload: Json }; Returns: Json };
      record_stock_movement: { Args: { p_tenant: string; p_payload: Json }; Returns: Json };
      void_sale: { Args: { p_tenant: string; p_sale_id: string; p_reason: string }; Returns: Json };
      customer_balance: { Args: { p_tenant: string; p_customer: string }; Returns: number };
      tenant_day_summary: { Args: { p_tenant: string; p_date?: string }; Returns: Json };
      is_tenant_member: { Args: { p_tenant: string }; Returns: boolean };
      has_tenant_role: { Args: { p_tenant: string; p_roles: string[] }; Returns: boolean };
    };
    Enums: {
      ledger_entry_type: 'debit' | 'credit';
      payment_method: 'cash' | 'bkash' | 'nagad' | 'rocket' | 'card' | 'bank' | 'other';
      sale_status: 'completed' | 'voided';
      stock_movement_type:
        'opening' | 'purchase' | 'sale' | 'sale_return' | 'adjustment' | 'damage';
      member_role: 'owner' | 'manager' | 'cashier';
      business_pack: 'grocery' | 'pharmacy' | 'clothing' | 'restaurant' | 'service' | 'general';
    };
    CompositeTypes: Record<string, never>;
  };
};
