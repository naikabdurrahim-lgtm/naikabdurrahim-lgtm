import { z } from 'zod';

import { getSupabase } from '@/lib/supabase/client';
import { normaliseBdPhone } from '@/features/auth/lib/phone';

import {
  CustomerApiError,
  LedgerApiError,
  type CustomerDetail,
  type CustomerInput,
  type CustomerSummary,
  type CustomerWithDue,
  type DueSummary,
  type LedgerEntry,
  type NewCustomer,
} from './types';

/**
 * Customers and the due ledger.
 *
 * Reads go through the four functions in 0014: the balance is derived from the
 * append-only ledger in Postgres, never summed in the browser (a page of a
 * ledger cannot add up to a total it has not seen). Writes stay on the table for
 * name/phone edits, while a collection goes through `collect_due()` (0009) and
 * its reversal through `void_payment()` (0015) — money never moves by UPDATE.
 */

type PgError = { code?: string; message?: string; details?: string } | null;

const numeric = z.union([z.number(), z.string()]).transform((value) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
});

const nullableNumber = z
  .union([z.number(), z.string(), z.null()])
  .transform((value) => (value === null ? null : Math.round(Number(value))))
  .nullable();

/** Postgres returns `bigint` as a string through PostgREST; the schema says number. */
const customerRow = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  due_paisa: numeric,
  credit_limit_paisa: nullableNumber,
  last_activity_at: z.string().nullable(),
  created_at: z.string(),
});

const detailRow = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  note: z.string().nullable(),
  due_paisa: numeric,
  credit_limit_paisa: nullableNumber,
  is_active: z.boolean(),
  is_deleted: z.boolean(),
  last_activity_at: z.string().nullable(),
  created_at: z.string(),
});

const summaryRow = z.object({
  total_due_paisa: numeric,
  debtor_count: numeric,
  customer_count: numeric,
  oldest_due_at: z.string().nullable(),
});

const ledgerRow = z.object({
  id: z.string().uuid(),
  entry_type: z.enum(['debit', 'credit']),
  amount_paisa: numeric,
  balance_after_paisa: numeric,
  occurred_at: z.string(),
  note: z.string().nullable(),
  sale_id: z.string().uuid().nullable(),
  payment_id: z.string().uuid().nullable(),
  invoice_no: z.string().nullable(),
});

function requireClient() {
  const sb = getSupabase();
  if (!sb) throw new CustomerApiError('not_configured');
  return sb;
}

function customerError(error: PgError): CustomerApiError {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();

  if (error?.code === '23505' || message.includes('customers_unique_active_phone')) {
    return new CustomerApiError('duplicate_phone', message);
  }
  if (error?.code === '23514' || message.includes('customers_phone_format')) {
    return new CustomerApiError('invalid_phone', message);
  }
  if (message.includes('no_data_found') || message.includes('not_found')) {
    return new CustomerApiError('not_found', message);
  }
  if (
    error?.code === '42501' ||
    message.includes('permission denied') ||
    message.includes('not_a_member')
  ) {
    return new CustomerApiError('forbidden', message);
  }
  if (message.includes('failed to fetch') || message.includes('networkerror')) {
    return new CustomerApiError('network', message);
  }
  return new CustomerApiError('unknown', message);
}

function ledgerError(error: PgError): LedgerApiError {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();

  if (message.includes('overpayment')) return new LedgerApiError('overpayment', message);
  if (message.includes('nothing_due')) return new LedgerApiError('nothing_due', message);
  if (message.includes('missing_customer')) return new LedgerApiError('missing_customer', message);
  if (
    error?.code === '42501' ||
    message.includes('permission denied') ||
    message.includes('not_a_member')
  ) {
    return new LedgerApiError('forbidden', message);
  }
  if (message.includes('failed to fetch') || message.includes('networkerror')) {
    return new LedgerApiError('network', message);
  }
  return new LedgerApiError('unknown', message);
}

/** One page of customers, debtors first. `onlyDue` is the বাকি screen. */
export async function listCustomers(
  tenantId: string,
  options: { query?: string; onlyDue?: boolean; limit?: number; offset?: number } = {},
): Promise<CustomerWithDue[]> {
  const sb = requireClient();
  const term = options.query?.trim() ?? '';

  // `exactOptionalPropertyTypes` is on, so an omitted optional is left out
  // rather than sent as undefined.
  const args: {
    p_tenant: string;
    p_query?: string;
    p_only_due: boolean;
    p_limit: number;
    p_offset: number;
  } = {
    p_tenant: tenantId,
    p_only_due: options.onlyDue ?? false,
    p_limit: options.limit ?? 50,
    p_offset: options.offset ?? 0,
  };
  if (term !== '') args.p_query = term;

  const { data, error } = await sb.rpc('list_customers', args);

  if (error) throw customerError(error);

  const parsed = z.array(customerRow).safeParse(data ?? []);
  if (!parsed.success) throw new CustomerApiError('unknown', parsed.error.message);

  return parsed.data.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    duePaisa: row.due_paisa,
    creditLimitPaisa: row.credit_limit_paisa,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
  }));
}

/**
 * The POS customer sheet. Same data as `listCustomers` minus the due-first
 * ordering, so a name search reads like a phone book.
 */
export async function searchCustomers(
  tenantId: string,
  query: string,
  limit = 20,
): Promise<CustomerSummary[]> {
  const rows = await listCustomers(tenantId, { query, limit });
  return rows
    .map(({ id, name, phone, duePaisa }) => ({ id, name, phone, duePaisa }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bn'));
}

export async function fetchDueSummary(tenantId: string): Promise<DueSummary> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('due_summary', { p_tenant: tenantId });
  if (error) throw customerError(error);

  // A `returns table` function arrives as a one-row array.
  const row = Array.isArray(data) ? data[0] : data;
  const parsed = summaryRow.safeParse(row ?? {});
  if (!parsed.success) throw new CustomerApiError('unknown', parsed.error.message);

  return {
    totalDuePaisa: parsed.data.total_due_paisa,
    debtorCount: parsed.data.debtor_count,
    customerCount: parsed.data.customer_count,
    oldestDueAt: parsed.data.oldest_due_at,
  };
}

export async function fetchCustomer(tenantId: string, customerId: string): Promise<CustomerDetail> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('get_customer', {
    p_tenant: tenantId,
    p_customer: customerId,
  });
  if (error) throw customerError(error);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new CustomerApiError('not_found');

  const parsed = detailRow.safeParse(row);
  if (!parsed.success) throw new CustomerApiError('unknown', parsed.error.message);

  return {
    id: parsed.data.id,
    name: parsed.data.name,
    phone: parsed.data.phone,
    address: parsed.data.address,
    note: parsed.data.note,
    duePaisa: parsed.data.due_paisa,
    creditLimitPaisa: parsed.data.credit_limit_paisa,
    isActive: parsed.data.is_active,
    isDeleted: parsed.data.is_deleted,
    lastActivityAt: parsed.data.last_activity_at,
    createdAt: parsed.data.created_at,
  };
}

export async function fetchCustomerLedger(
  tenantId: string,
  customerId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<LedgerEntry[]> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('customer_ledger', {
    p_tenant: tenantId,
    p_customer: customerId,
    p_limit: options.limit ?? 50,
    p_offset: options.offset ?? 0,
  });
  if (error) throw customerError(error);

  const parsed = z.array(ledgerRow).safeParse(data ?? []);
  if (!parsed.success) throw new CustomerApiError('unknown', parsed.error.message);

  return parsed.data.map((row) => ({
    id: row.id,
    entryType: row.entry_type,
    amountPaisa: row.amount_paisa,
    balanceAfterPaisa: row.balance_after_paisa,
    occurredAt: row.occurred_at,
    note: row.note,
    saleId: row.sale_id,
    paymentId: row.payment_id,
    invoiceNo: row.invoice_no,
  }));
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
    .insert({
      tenant_id: tenantId,
      name: input.name.trim(),
      phone,
      address: input.address?.trim() || null,
      note: input.note?.trim() || null,
      credit_limit_paisa: input.creditLimitPaisa ?? null,
    })
    .select('id, name, phone')
    .single();

  if (error) throw customerError(error);
  const row = z
    .object({ id: z.string().uuid(), name: z.string(), phone: z.string().nullable() })
    .safeParse(data);
  if (!row.success) throw new CustomerApiError('unknown', row.error.message);

  // A brand-new customer has no history, so the derived balance is zero.
  return { ...row.data, duePaisa: 0 };
}

export async function updateCustomer(
  tenantId: string,
  customerId: string,
  input: CustomerInput,
): Promise<void> {
  const sb = requireClient();

  const phone = input.phone ? normaliseBdPhone(input.phone) : null;
  if (input.phone && !phone) throw new CustomerApiError('invalid_phone');

  const { error } = await sb
    .from('customers')
    .update({
      name: input.name.trim(),
      phone,
      address: input.address?.trim() || null,
      note: input.note?.trim() || null,
      credit_limit_paisa: input.creditLimitPaisa ?? null,
    })
    .eq('tenant_id', tenantId)
    .eq('id', customerId);

  if (error) throw customerError(error);
}

/**
 * Soft delete: the row stays so old sales and ledger lines still resolve to a
 * name. The list hides it (`deleted_at is null`), the khata keeps it.
 */
export async function deleteCustomer(tenantId: string, customerId: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb
    .from('customers')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('tenant_id', tenantId)
    .eq('id', customerId);

  if (error) throw customerError(error);
}

export type CollectInput = {
  customerId: string;
  amountPaisa: number;
  method: 'cash' | 'bkash' | 'nagad' | 'rocket' | 'card' | 'bank' | 'other';
  note?: string | null;
  /** Client-generated UUID: a retried collection is a duplicate, not a second payment. */
  clientId: string;
};

export type CollectResult = {
  paymentId: string;
  amountPaisa: number;
  balancePaisa: number;
  duplicate: boolean;
};

const collectResultSchema = z
  .object({
    payment_id: z.string().uuid().optional(),
    amount_paisa: numeric.optional(),
    balance_paisa: numeric.optional(),
    duplicate: z.boolean().optional(),
  })
  // A duplicate reply is `{ duplicate: true }` and nothing else.
  .passthrough();

export async function collectPayment(
  tenantId: string,
  input: CollectInput,
): Promise<CollectResult> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('collect_due', {
    p_tenant: tenantId,
    p_payload: {
      client_id: input.clientId,
      customer_id: input.customerId,
      amount_paisa: input.amountPaisa,
      method: input.method,
      note: input.note ?? undefined,
    },
  });

  if (error) throw ledgerError(error);

  const parsed = collectResultSchema.safeParse(data ?? {});
  if (!parsed.success) throw new LedgerApiError('unknown', parsed.error.message);

  const duplicate = parsed.data.duplicate ?? false;
  if (duplicate && !parsed.data.payment_id) {
    // The server only says "I already have this one"; nothing to edit on screen.
    return { paymentId: '', amountPaisa: input.amountPaisa, balancePaisa: 0, duplicate: true };
  }

  return {
    paymentId: parsed.data.payment_id ?? '',
    amountPaisa: parsed.data.amount_paisa ?? input.amountPaisa,
    balancePaisa: parsed.data.balance_paisa ?? 0,
    duplicate,
  };
}

export async function voidPayment(
  tenantId: string,
  paymentId: string,
  reason?: string,
): Promise<{ alreadyVoided: boolean; balancePaisa: number }> {
  const sb = requireClient();
  const args: { p_tenant: string; p_payment: string; p_reason?: string } = {
    p_tenant: tenantId,
    p_payment: paymentId,
  };
  if (reason) args.p_reason = reason;

  const { data, error } = await sb.rpc('void_payment', args);

  if (error) throw ledgerError(error);

  const parsed = z
    .object({
      already_voided: z.boolean().optional(),
      balance_paisa: numeric.optional(),
    })
    .safeParse(data ?? {});
  if (!parsed.success) throw new LedgerApiError('unknown', parsed.error.message);

  return {
    alreadyVoided: parsed.data.already_voided ?? false,
    balancePaisa: parsed.data.balance_paisa ?? 0,
  };
}
