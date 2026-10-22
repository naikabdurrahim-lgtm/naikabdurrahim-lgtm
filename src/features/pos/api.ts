import { z } from 'zod';

import { getSupabase } from '@/lib/supabase/client';
import { isUnitCode, type UnitCode } from '@/packs';

import type { SalePayload } from './cart';
import {
  PosError,
  type PosErrorCode,
  type PosSettings,
  type Receipt,
  type ReceiptItem,
  type SaleResult,
} from './types';

/**
 * The only module that talks to Postgres for a sale.
 *
 * A sale is written by `create_sale()` and cancelled by `void_sale()` — there is
 * deliberately no insert path from the client (0005/0009): the server owns the
 * invoice number, the totals, the stock movement and the ledger entry.
 */

type PgError = { code?: string; message?: string; details?: string } | null;

const KNOWN_CODES: readonly PosErrorCode[] = [
  'insufficient_stock',
  'below_cost_not_allowed',
  'discount_not_allowed',
  'due_requires_customer',
  'unknown_product',
  'invalid_paid_amount',
  'empty_sale',
  'not_member',
  'forbidden',
  'not_configured',
  'network',
];

function mapError(error: PgError): PosError {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();

  // Postgres puts the raised message first ("insufficient_stock: product …"), so
  // matching on the prefix is enough and survives the added detail.
  for (const code of KNOWN_CODES) {
    if (message.includes(code)) return new PosError(code, message);
  }
  if (message.includes('not_a_member')) return new PosError('not_member', message);
  if (error?.code === '42501' || message.includes('permission denied')) {
    return new PosError('forbidden', message);
  }
  if (message.includes('failed to fetch') || message.includes('networkerror')) {
    return new PosError('network', message);
  }
  return new PosError('unknown', message);
}

function requireClient() {
  const sb = getSupabase();
  if (!sb) throw new PosError('not_configured');
  return sb;
}

const numeric = z.union([z.number(), z.string()]).transform((value) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
});

/** create_sale returns fewer keys when it recognises a duplicate client_id. */
const saleResultSchema = z.object({
  sale_id: z.string().uuid(),
  invoice_no: z.string().nullable().optional(),
  subtotal_paisa: numeric.optional(),
  discount_paisa: numeric.optional(),
  total_paisa: numeric,
  paid_paisa: numeric,
  due_paisa: numeric,
  duplicate: z.boolean().optional(),
});

export async function createSale(tenantId: string, payload: SalePayload): Promise<SaleResult> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('create_sale', { p_tenant: tenantId, p_payload: payload });
  if (error) throw mapError(error);

  const parsed = saleResultSchema.safeParse(data);
  if (!parsed.success) throw new PosError('unknown', parsed.error.message);

  return {
    saleId: parsed.data.sale_id,
    invoiceNo: parsed.data.invoice_no ?? null,
    subtotalPaisa: parsed.data.subtotal_paisa ?? 0,
    discountPaisa: parsed.data.discount_paisa ?? 0,
    totalPaisa: parsed.data.total_paisa,
    paidPaisa: parsed.data.paid_paisa,
    duePaisa: parsed.data.due_paisa,
    duplicate: parsed.data.duplicate ?? false,
  };
}

const voidResultSchema = z.object({
  sale_id: z.string().uuid(),
  status: z.string().optional(),
  already_voided: z.boolean().optional(),
});

export async function voidSale(
  tenantId: string,
  saleId: string,
  reason: string,
): Promise<{ saleId: string; alreadyVoided: boolean }> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('void_sale', {
    p_tenant: tenantId,
    p_sale_id: saleId,
    p_reason: reason,
  });
  if (error) throw mapError(error);

  const parsed = voidResultSchema.safeParse(data);
  if (!parsed.success) throw new PosError('unknown', parsed.error.message);
  return { saleId: parsed.data.sale_id, alreadyVoided: parsed.data.already_voided ?? false };
}

const saleRowSchema = z.object({
  id: z.string().uuid(),
  invoice_no: z.string().nullable(),
  created_at: z.string(),
  business_date: z.string(),
  status: z.union([z.literal('completed'), z.literal('voided')]),
  customer_id: z.string().uuid().nullable(),
  subtotal_paisa: numeric,
  discount_paisa: numeric,
  discount_kind: z.union([z.literal('amount'), z.literal('percent')]),
  total_paisa: numeric,
  paid_paisa: numeric,
  due_paisa: numeric,
  note: z.string().nullable(),
});

const receiptItemRowSchema = z.object({
  id: z.string().uuid(),
  name_snapshot: z.string().min(1),
  unit_code: z.string(),
  qty: z.union([z.number(), z.string()]).transform((value) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 1000) : 0;
  }),
  unit_price_paisa: numeric,
  discount_paisa: numeric,
  line_total_paisa: numeric,
  sort_order: numeric,
});

export const SALES_TABLE = 'sales';

/**
 * Reads a receipt back from the database. Any member may read `sales`; the lines
 * come from `v_sale_items_receipt`, which already excludes cost price, so a
 * cashier can reprint without ever seeing what the shop paid.
 */
export async function fetchReceipt(tenantId: string, saleId: string): Promise<Receipt | null> {
  const sb = requireClient();

  const saleResult = await sb
    .from('sales')
    .select(
      'id, invoice_no, created_at, business_date, status, customer_id, subtotal_paisa, discount_paisa, discount_kind, total_paisa, paid_paisa, due_paisa, note',
    )
    .eq('tenant_id', tenantId)
    .eq('id', saleId)
    .maybeSingle();

  if (saleResult.error) throw mapError(saleResult.error);
  if (!saleResult.data) return null;

  const sale = saleRowSchema.safeParse(saleResult.data);
  if (!sale.success) throw new PosError('unknown', sale.error.message);

  const itemsResult = await sb
    .from('v_sale_items_receipt')
    .select(
      'id, name_snapshot, unit_code, qty, unit_price_paisa, discount_paisa, line_total_paisa, sort_order',
    )
    .eq('tenant_id', tenantId)
    .eq('sale_id', saleId)
    .order('sort_order', { ascending: true });

  if (itemsResult.error) throw mapError(itemsResult.error);

  const itemRows = z.array(receiptItemRowSchema).safeParse(itemsResult.data ?? []);
  if (!itemRows.success) throw new PosError('unknown', itemRows.error.message);

  const items: ReceiptItem[] = itemRows.data.map((row) => ({
    id: row.id,
    name: row.name_snapshot,
    unitCode: (isUnitCode(row.unit_code) ? row.unit_code : 'piece') as UnitCode,
    qtyMilli: row.qty,
    unitPricePaisa: row.unit_price_paisa,
    discountPaisa: row.discount_paisa,
    lineTotalPaisa: row.line_total_paisa,
  }));

  const [customerName, footer] = await Promise.all([
    sale.data.customer_id
      ? fetchCustomerName(tenantId, sale.data.customer_id)
      : Promise.resolve(null),
    fetchReceiptFooter(tenantId),
  ]);

  return {
    saleId: sale.data.id,
    invoiceNo: sale.data.invoice_no,
    createdAt: sale.data.created_at,
    businessDate: sale.data.business_date,
    status: sale.data.status,
    customerName,
    subtotalPaisa: sale.data.subtotal_paisa,
    discountPaisa: sale.data.discount_paisa,
    discountKind: sale.data.discount_kind,
    totalPaisa: sale.data.total_paisa,
    paidPaisa: sale.data.paid_paisa,
    duePaisa: sale.data.due_paisa,
    note: sale.data.note,
    items,
    footer,
  };
}

async function fetchCustomerName(tenantId: string, customerId: string): Promise<string | null> {
  const sb = requireClient();
  const { data, error } = await sb
    .from('customers')
    .select('name')
    .eq('tenant_id', tenantId)
    .eq('id', customerId)
    .maybeSingle();
  // A missing name must never break a receipt.
  if (error || !data) return null;
  const parsed = z.object({ name: z.string() }).safeParse(data);
  return parsed.success ? parsed.data.name : null;
}

async function fetchReceiptFooter(tenantId: string): Promise<string | null> {
  const sb = requireClient();
  const { data, error } = await sb
    .from('app_settings')
    .select('receipt_footer')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error || !data) return null;
  const parsed = z.object({ receipt_footer: z.string() }).safeParse(data);
  return parsed.success ? parsed.data.receipt_footer : null;
}

const settingsRowSchema = z.object({
  receipt_footer: z.string(),
  receipt_header: z.string().nullable(),
  allow_cashier_discount: z.boolean(),
  allow_negative_stock: z.boolean(),
});

export async function fetchPosSettings(tenantId: string): Promise<PosSettings> {
  const sb = requireClient();
  const { data, error } = await sb
    .from('app_settings')
    .select('receipt_footer, receipt_header, allow_cashier_discount, allow_negative_stock')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  // Settings are a nicety on the POS: a failure must not stop a sale.
  if (error || !data) {
    return {
      receiptFooter: '',
      receiptHeader: null,
      allowCashierDiscount: true,
      allowNegativeStock: false,
    };
  }

  const parsed = settingsRowSchema.safeParse(data);
  if (!parsed.success) {
    return {
      receiptFooter: '',
      receiptHeader: null,
      allowCashierDiscount: true,
      allowNegativeStock: false,
    };
  }

  return {
    receiptFooter: parsed.data.receipt_footer,
    receiptHeader: parsed.data.receipt_header,
    allowCashierDiscount: parsed.data.allow_cashier_discount,
    allowNegativeStock: parsed.data.allow_negative_stock,
  };
}
