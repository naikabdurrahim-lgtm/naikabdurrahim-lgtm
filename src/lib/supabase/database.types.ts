/**
 * Database types. Phase 2 replaces this stub with generated types from
 * `supabase gen types typescript`. Keeping the shape stable now means the
 * client code does not change when the real schema lands.
 */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
