import { z } from 'zod';

import { getSupabase } from '@/lib/supabase/client';
import { normaliseBdPhone } from '@/features/auth/lib/phone';

import { CustomerApiError, type CustomerSummary, type NewCustomer } from './types';

/**
 * Customer reads and writes for the POS.
 *
 * Plain RLS-checked table access: a member may select, and every role may insert
 * a customer (0008_rls.sql), which is exactly what "sell to a new person on
 * credit" needs. Balances belong to the ledger screen in Phase 6.
 */

const customerRow = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().nullable(),
});

type PgError = { code?: string; message?: string; details?: string } | null;

function mapError(error: PgError): CustomerApiError {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();

  if (error?.code === '23505' || message.includes('customers_unique_active_phone')) {
    return new CustomerApiError('duplicate_phone', message);
  }
  if (error?.code === '23514' || message.includes('customers_phone_format')) {
    return new CustomerApiError('invalid_phone', message);
  }
  if (error?.code === '42501' || message.includes('permission denied')) {
    return new CustomerApiError('forbidden', message);
  }
  if (message.includes('failed to fetch') || message.includes('networkerror')) {
    return new CustomerApiError('network', message);
  }
  return new CustomerApiError('unknown', message);
}

function requireClient() {
  const sb = getSupabase();
  if (!sb) throw new CustomerApiError('not_configured');
  return sb;
}

/**
 * Searches name and phone. `ilike` is enough for a shop's customer list, which
 * rarely passes a few thousand rows; a trigram index can come with Phase 6 if
 * the numbers say it is needed.
 */
export async function searchCustomers(
  tenantId: string,
  query: string,
  limit = 20,
): Promise<CustomerSummary[]> {
  const sb = requireClient();
  const term = query.trim();
  // Escape the PostgREST filter separators so "a,b" is a search term, not a list.
  const safe = term.replace(/[,()%]/g, ' ').trim();

  let builder = sb
    .from('customers')
    .select('id, name, phone')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(limit);

  if (safe !== '') {
    builder = builder.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }

  const { data, error } = await builder;
  if (error) throw mapError(error);

  const rows = z.array(customerRow).safeParse(data ?? []);
  if (!rows.success) throw new CustomerApiError('unknown', rows.error.message);
  return rows.data;
}

export async function createCustomer(
  tenantId: string,
  input: NewCustomer,
): Promise<CustomerSummary> {
  const sb = requireClient();

  const phone = input.phone ? normaliseBdPhone(input.phone) : null;
  if (input.phone && !phone) throw new CustomerApiError('invalid_phone');

  const { data, error } = await sb
    .from('customers')
    .insert({ tenant_id: tenantId, name: input.name.trim(), phone })
    .select('id, name, phone')
    .single();

  if (error) throw mapError(error);
  const row = customerRow.safeParse(data);
  if (!row.success) throw new CustomerApiError('unknown', row.error.message);
  return row.data;
}
