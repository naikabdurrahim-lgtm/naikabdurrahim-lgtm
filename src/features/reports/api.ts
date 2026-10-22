import { z } from 'zod';

import { getSupabase } from '@/lib/supabase/client';

import {
  ReportApiError,
  type DayPoint,
  type RecentSale,
  type ReportRange,
  type TodaySummary,
  type TopProduct,
} from './types';

/**
 * Reports are computed in Postgres (0016): `tenant_day_summary()`,
 * `recent_sales()`, `sales_report()` and `top_products()`.
 *
 * Doing the arithmetic in the browser would mean downloading every sale, and it
 * would let a tampered page print its own profit. The functions also enforce who
 * may see profit at all.
 */

type PgError = { code?: string; message?: string; details?: string } | null;

const num = z
  .union([z.number(), z.string()])
  .transform((value) => (Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0));

const nullableInt = z
  .union([z.number(), z.string(), z.null()])
  .transform((value) => (value === null ? null : Math.round(Number(value))));

function requireClient() {
  const sb = getSupabase();
  if (!sb) throw new ReportApiError('not_configured');
  return sb;
}

function mapError(error: PgError): ReportApiError {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();

  if (
    error?.code === '42501' ||
    message.includes('forbidden') ||
    message.includes('permission denied') ||
    message.includes('not_a_member')
  ) {
    return new ReportApiError('forbidden', message);
  }
  if (message.includes('failed to fetch') || message.includes('networkerror')) {
    return new ReportApiError('network', message);
  }
  return new ReportApiError('unknown', message);
}

/** Today (or any day) in the shop's timezone: what the counter did. */
export async function fetchToday(tenantId: string, date?: string): Promise<TodaySummary> {
  const sb = requireClient();
  const args: { p_tenant: string; p_date?: string } = { p_tenant: tenantId };
  if (date) args.p_date = date;

  const { data, error } = await sb.rpc('tenant_day_summary', args);
  if (error) throw mapError(error);

  const parsed = z
    .object({
      business_date: z.string(),
      sale_count: num,
      sales_paisa: num,
      credit_given_paisa: num,
      collected_paisa: num,
      profit_paisa: nullableInt,
    })
    .safeParse(data ?? {});
  if (!parsed.success) throw new ReportApiError('unknown', parsed.error.message);

  return {
    businessDate: parsed.data.business_date,
    saleCount: parsed.data.sale_count,
    salesPaisa: parsed.data.sales_paisa,
    creditPaisa: parsed.data.credit_given_paisa,
    collectedPaisa: parsed.data.collected_paisa,
    profitPaisa: parsed.data.profit_paisa,
  };
}

const saleRow = z.object({
  id: z.string().uuid(),
  invoice_no: z.string().nullable(),
  total_paisa: num,
  due_paisa: num,
  status: z.enum(['completed', 'voided']),
  business_date: z.string(),
  created_at: z.string(),
  customer_name: z.string().nullable(),
  item_count: num,
});

export async function fetchRecentSales(
  tenantId: string,
  options: { date?: string; limit?: number; offset?: number } = {},
): Promise<RecentSale[]> {
  const sb = requireClient();
  const args: {
    p_tenant: string;
    p_limit: number;
    p_offset: number;
    p_date?: string;
  } = {
    p_tenant: tenantId,
    p_limit: options.limit ?? 20,
    p_offset: options.offset ?? 0,
  };
  if (options.date) args.p_date = options.date;

  const { data, error } = await sb.rpc('recent_sales', args);
  if (error) throw mapError(error);

  const parsed = z.array(saleRow).safeParse(data ?? []);
  if (!parsed.success) throw new ReportApiError('unknown', parsed.error.message);

  return parsed.data.map((row) => ({
    id: row.id,
    invoiceNo: row.invoice_no,
    totalPaisa: row.total_paisa,
    duePaisa: row.due_paisa,
    status: row.status,
    businessDate: row.business_date,
    createdAt: row.created_at,
    customerName: row.customer_name,
    itemCount: row.item_count,
  }));
}

const dayRow = z.object({
  business_date: z.string(),
  sale_count: num,
  sales_paisa: num,
  credit_paisa: num,
  collected_paisa: num,
  profit_paisa: num,
});

/** First and last day of a range, as `YYYY-MM-DD` in Dhaka. */
export function rangeDates(
  range: ReportRange,
  now: Date = new Date(),
): {
  from: string;
  to: string;
} {
  const dhakaToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const days = range === 'today' ? 0 : range === 'week' ? 6 : 29;
  const start = new Date(`${dhakaToday}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days);

  return { from: start.toISOString().slice(0, 10), to: dhakaToday };
}

export async function fetchSalesReport(
  tenantId: string,
  from: string,
  to: string,
): Promise<DayPoint[]> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('sales_report', {
    p_tenant: tenantId,
    p_from: from,
    p_to: to,
  });
  if (error) throw mapError(error);

  const parsed = z.array(dayRow).safeParse(data ?? []);
  if (!parsed.success) throw new ReportApiError('unknown', parsed.error.message);

  return parsed.data.map((row) => ({
    date: row.business_date,
    saleCount: row.sale_count,
    salesPaisa: row.sales_paisa,
    creditPaisa: row.credit_paisa,
    collectedPaisa: row.collected_paisa,
    profitPaisa: row.profit_paisa,
  }));
}

const topRow = z.object({
  product_id: z.string().uuid(),
  name: z.string(),
  qty: z.union([z.number(), z.string()]).transform((value) => Math.round(Number(value) * 1000)),
  revenue_paisa: num,
  profit_paisa: num,
  sale_count: num,
});

export async function fetchTopProducts(
  tenantId: string,
  from: string,
  to: string,
  limit = 10,
): Promise<TopProduct[]> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('top_products', {
    p_tenant: tenantId,
    p_from: from,
    p_to: to,
    p_limit: limit,
  });
  if (error) throw mapError(error);

  const parsed = z.array(topRow).safeParse(data ?? []);
  if (!parsed.success) throw new ReportApiError('unknown', parsed.error.message);

  return parsed.data.map((row) => ({
    productId: row.product_id,
    name: row.name,
    qtyMilli: row.qty,
    revenuePaisa: row.revenue_paisa,
    profitPaisa: row.profit_paisa,
    saleCount: row.sale_count,
  }));
}
