import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Single Supabase browser client.
 *
 * Security notes (PROJECT_RULES 5.1 / 5.5 / 6):
 * - Only the ANON key is ever used here. The service-role key must never ship
 *   to a browser or an Android build.
 * - Sessions are kept in memory + storage through the library's own session
 *   handling; Phase 3 swaps this for the safer storage strategy on Android.
 */
let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient<Database>(
      env.VITE_SUPABASE_URL as string,
      env.VITE_SUPABASE_ANON_KEY as string,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // A synthetic phone-based email is used in Phase 3, so no magic links.
          flowType: 'pkce',
        },
        global: {
          headers: { 'x-application-name': 'dokan-bondhu' },
        },
      },
    );
  }
  return client;
}

/**
 * Lightweight connectivity probe used by the health check. Does not require
 * authentication and never throws: it reports a plain status instead.
 */
export async function checkSupabaseConnection(): Promise<'ok' | 'unconfigured' | 'unreachable'> {
  const sb = getSupabase();
  if (!sb) return 'unconfigured';
  try {
    // A cheap, anonymous, RLS-protected call. Any HTTP response means the
    // project is reachable; network errors are caught below.
    const { error } = await sb.auth.getSession();
    if (error && error.message.toLowerCase().includes('fetch')) return 'unreachable';
    return 'ok';
  } catch {
    return 'unreachable';
  }
}
