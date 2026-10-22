import { z } from 'zod';

import { getSupabase } from '@/lib/supabase/client';

import {
  StockApiError,
  type NewMovement,
  type StockFilter,
  type StockItem,
  type StockMovement,
  type StockOverview,
} from './types';

/**
 * Stock reads and the one write a shopkeeper makes by hand.
 *
 * Reading goes through `list_stock` / `stock_overview` / `product_stock_movements`
 * (0016) so the counts and the running quantity are computed where the history
 * is. Writing goes through `record_stock_movement` (0009): an adjustment is a
 * movement with a reason, never a column update.
 */

type PgError = { code?: string; message?: string; details?: string } | null;

const num = z
  .union([z.number(), z.string()])
  .transform((value) => (Number.isFinite(Number(value)) ? Number(value) : 0));

const nullableInt = z
  .union([z.number(), z.string(), z.null()])
  .transform((value) => (value === null ? null : Math.round(Number(value))));

const itemRow = z.object({
  id: z.string().uuid(),
  name: z.string(),
  unit_code: z.string(),
  stock_qty: num,
  stock_alert_qty: num,
  sell_price_paisa: num,
  buy_price_paisa: nullableInt,
  stock_value_paisa: nullableInt,
  is_service: z.boolean(),
  last_movement_at: z.string().nullable(),
});

const overviewRow = z.object({
  product_count: num,
  low_stock_count: num,
  out_of_stock_count: num,
  stock_value_paisa: nullableInt,
});

const movementRow = z.object({
  id: z.string().uuid(),
  movement_type: z.enum(['opening', 'purchase', 'sale', 'sale_return', 'adjustment', 'damage']),
  qty_delta: num,
  unit_cost_paisa: nullableInt,
  reason: z.string().nullable(),
  occurred_at: z.string(),
  reference_type: z.string().nullable(),
  created_by_name: z.string().nullable(),
  running_qty: num,
});

/** Postgres sends numeric(14,3) as "18.000"; the app counts thousandths. */
function toMilli(value: number): number {
  return Math.round(value * 1000);
}

function requireClient() {
  const sb = getSupabase();
  if (!sb) throw new StockApiError('not_configured');
  return sb;
}

function mapError(error: PgError): StockApiError {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();

  if (message.includes('reason_required')) return new StockApiError('reason_required', message);
  if (message.includes('invalid_quantity')) return new StockApiError('invalid_quantity', message);
  if (message.includes('stock_movement_on_service_product')) {
    return new StockApiError('stock_movement_on_service_product', message);
  }
  if (
    error?.code === '42501' ||
    message.includes('permission denied') ||
    message.includes('forbidden') ||
    message.includes('not_a_member')
  ) {
    return new StockApiError('forbidden', message);
  }
  if (message.includes('no_data_found') || message.includes('not_found')) {
    return new StockApiError('not_found', message);
  }
  if (message.includes('failed to fetch') || message.includes('networkerror')) {
    return new StockApiError('network', message);
  }
  return new StockApiError('unknown', message);
}

export async function fetchStockOverview(tenantId: string): Promise<StockOverview> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('stock_overview', { p_tenant: tenantId });
  if (error) throw mapError(error);

  const row = Array.isArray(data) ? data[0] : data;
  const parsed = overviewRow.safeParse(row ?? {});
  if (!parsed.success) throw new StockApiError('unknown', parsed.error.message);

  return {
    productCount: parsed.data.product_count,
    lowCount: parsed.data.low_stock_count,
    outCount: parsed.data.out_of_stock_count,
    valuePaisa: parsed.data.stock_value_paisa,
  };
}

export async function listStock(
  tenantId: string,
  options: { query?: string; filter?: StockFilter; limit?: number; offset?: number } = {},
): Promise<StockItem[]> {
  const sb = requireClient();
  const term = options.query?.trim() ?? '';

  const args: {
    p_tenant: string;
    p_filter: string;
    p_limit: number;
    p_offset: number;
    p_query?: string;
  } = {
    p_tenant: tenantId,
    p_filter: options.filter ?? 'all',
    p_limit: options.limit ?? 50,
    p_offset: options.offset ?? 0,
  };
  if (term !== '') args.p_query = term;

  const { data, error } = await sb.rpc('list_stock', args);
  if (error) throw mapError(error);

  const parsed = z.array(itemRow).safeParse(data ?? []);
  if (!parsed.success) throw new StockApiError('unknown', parsed.error.message);

  return parsed.data.map((row) => ({
    id: row.id,
    name: row.name,
    unitCode: row.unit_code,
    stockMilli: toMilli(row.stock_qty),
    alertMilli: toMilli(row.stock_alert_qty),
    sellPricePaisa: row.sell_price_paisa,
    buyPricePaisa: row.buy_price_paisa,
    stockValuePaisa: row.stock_value_paisa,
    isService: row.is_service,
    lastMovementAt: row.last_movement_at,
  }));
}

export async function fetchStockMovements(
  tenantId: string,
  productId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<StockMovement[]> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('product_stock_movements', {
    p_tenant: tenantId,
    p_product: productId,
    p_limit: options.limit ?? 50,
    p_offset: options.offset ?? 0,
  });
  if (error) throw mapError(error);

  const parsed = z.array(movementRow).safeParse(data ?? []);
  if (!parsed.success) throw new StockApiError('unknown', parsed.error.message);

  return parsed.data.map((row) => ({
    id: row.id,
    type: row.movement_type,
    qtyMilli: toMilli(row.qty_delta),
    unitCostPaisa: row.unit_cost_paisa ?? 0,
    reason: row.reason,
    occurredAt: row.occurred_at,
    referenceType: row.reference_type,
    createdByName: row.created_by_name ?? '',
    runningMilli: toMilli(row.running_qty),
  }));
}

export type RecordedMovement = {
  movementId: string;
  productId: string;
  stockMilli: number;
  duplicate: boolean;
};

export async function recordMovement(
  tenantId: string,
  input: NewMovement,
): Promise<RecordedMovement> {
  const sb = requireClient();

  const { data, error } = await sb.rpc('record_stock_movement', {
    p_tenant: tenantId,
    p_payload: {
      client_id: input.clientId,
      product_id: input.productId,
      movement_type: input.type,
      // Postgres wants numeric(14,3) as a string, not a float that may drift.
      qty_delta: (input.qtyMilli / 1000).toFixed(3),
      unit_cost_paisa: input.unitCostPaisa ?? 0,
      reason: input.reason,
    },
  });
  if (error) throw mapError(error);

  const parsed = z
    .object({
      movement_id: z.string().uuid().optional(),
      product_id: z.string().uuid().optional(),
      stock_qty: num.optional(),
      duplicate: z.boolean().optional(),
    })
    .safeParse(data ?? {});
  if (!parsed.success) throw new StockApiError('unknown', parsed.error.message);

  return {
    movementId: parsed.data.movement_id ?? '',
    productId: parsed.data.product_id ?? input.productId,
    stockMilli: toMilli(parsed.data.stock_qty ?? 0),
    duplicate: parsed.data.duplicate ?? false,
  };
}
