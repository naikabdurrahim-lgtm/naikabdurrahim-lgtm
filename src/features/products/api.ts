import { z } from 'zod';

import { getSupabase } from '@/lib/supabase/client';
import { isUnitCode, type UnitCode } from '@/packs';
import type { Database } from '@/lib/supabase/database.types';

import {
  ProductApiError,
  type Category,
  type Product,
  type ProductInput,
  type ProductListFilters,
} from './types';

/**
 * The only module that talks to Postgres for the catalogue.
 *
 * Reads go through `search_products()` and `list_categories()` (migration 0012):
 * server-side search and paging, and cost masked for cashiers. Writes use the
 * table directly, which RLS already restricts to owner/manager.
 *
 * Everything coming back is parsed with Zod. The generated types say a column
 * "may be null"; these schemas decide what is actually acceptable and turn a
 * surprise into one friendly error instead of a crash deep in a component.
 */

const NUMERIC = z.union([z.number(), z.string()]).transform((value) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
});

const productRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  name_en: z.string().nullable(),
  category_id: z.string().uuid().nullable(),
  category_name: z.string().nullable(),
  unit_code: z.string(),
  barcode: z.string().nullable(),
  sku: z.string().nullable(),
  sell_price_paisa: NUMERIC,
  buy_price_paisa: NUMERIC.nullable(),
  wholesale_price_paisa: NUMERIC.nullable(),
  stock_qty: NUMERIC,
  stock_alert_qty: NUMERIC,
  is_service: z.boolean(),
  is_active: z.boolean(),
  updated_at: z.string(),
});

const categoryRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  name_en: z.string().nullable(),
  icon: z.string(),
  sort_order: NUMERIC,
  is_active: z.boolean(),
  product_count: NUMERIC,
});

/** PostgREST errors are plain objects; this is the part we care about. */
type PgError = { code?: string; message?: string; details?: string } | null;

function mapError(error: PgError): ProductApiError {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();

  // Unique violations are the ones a shopkeeper can act on.
  if (error?.code === '23505') {
    if (message.includes('barcode')) return new ProductApiError('duplicate_barcode', message);
    if (message.includes('sku')) return new ProductApiError('duplicate_sku', message);
    if (message.includes('categories_unique_active_name') || message.includes('category')) {
      return new ProductApiError('duplicate_category', message);
    }
  }
  if (
    error?.code === '42501' ||
    message.includes('permission denied') ||
    message.includes('not_a_member')
  ) {
    return new ProductApiError('forbidden', message);
  }
  if (error?.code === 'PGRST116') return new ProductApiError('not_found', message);
  if (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('fetch')
  ) {
    return new ProductApiError('network', message);
  }
  return new ProductApiError('unknown', message);
}

function requireClient() {
  const sb = getSupabase();
  if (!sb) throw new ProductApiError('not_configured');
  return sb;
}

function toProduct(row: z.infer<typeof productRowSchema>): Product {
  return {
    id: row.id,
    name: row.name,
    nameEn: row.name_en,
    categoryId: row.category_id,
    categoryName: row.category_name,
    unitCode: (isUnitCode(row.unit_code) ? row.unit_code : 'piece') as UnitCode,
    barcode: row.barcode,
    sku: row.sku,
    sellPricePaisa: Math.round(row.sell_price_paisa),
    buyPricePaisa: row.buy_price_paisa === null ? null : Math.round(row.buy_price_paisa),
    wholesalePricePaisa:
      row.wholesale_price_paisa === null ? null : Math.round(row.wholesale_price_paisa),
    // numeric(14,3) comes back as a number; thousandths keeps the app integer-only.
    stockMilli: Math.round(row.stock_qty * 1000),
    stockAlertMilli: Math.round(row.stock_alert_qty * 1000),
    isService: row.is_service,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}

export const PRODUCT_PAGE_SIZE = 40;

export async function fetchProducts(
  tenantId: string,
  filters: ProductListFilters,
  offset = 0,
): Promise<Product[]> {
  const sb = requireClient();
  const query = filters.query.trim();

  const args = {
    p_tenant: tenantId,
    p_limit: PRODUCT_PAGE_SIZE,
    p_offset: offset,
    p_include_inactive: true,
    ...(query === '' ? {} : { p_query: query }),
    ...(filters.categoryId ? { p_category: filters.categoryId } : {}),
    ...(filters.lowStock ? { p_low_stock: true } : {}),
  };

  const { data, error } = await sb.rpc('search_products', args);
  if (error) throw mapError(error);

  const rows = z.array(productRowSchema).safeParse(data ?? []);
  if (!rows.success) throw new ProductApiError('unknown', rows.error.message);
  return rows.data.map(toProduct);
}

export async function fetchProduct(tenantId: string, productId: string): Promise<Product> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('search_products', {
    p_tenant: tenantId,
    p_id: productId,
    p_limit: 1,
  });
  if (error) throw mapError(error);

  const rows = z.array(productRowSchema).safeParse(data ?? []);
  const first = rows.success ? rows.data[0] : undefined;
  if (!first) throw new ProductApiError('not_found');
  return toProduct(first);
}

export async function fetchCategories(tenantId: string): Promise<Category[]> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('list_categories', { p_tenant: tenantId });
  if (error) throw mapError(error);

  const rows = z.array(categoryRowSchema).safeParse(data ?? []);
  if (!rows.success) throw new ProductApiError('unknown', rows.error.message);

  return rows.data.map((row) => ({
    id: row.id,
    name: row.name,
    nameEn: row.name_en,
    icon: row.icon,
    sortOrder: Math.round(row.sort_order),
    isActive: row.is_active,
    productCount: Math.round(row.product_count),
  }));
}

type ProductRow = Database['public']['Tables']['products']['Insert'];

function toProductRow(input: ProductInput): ProductRow {
  return {
    tenant_id: input.tenantId,
    name: input.name,
    name_en: input.nameEn,
    category_id: input.categoryId,
    unit_code: input.unitCode,
    barcode: input.barcode,
    sku: input.sku,
    sell_price_paisa: input.sellPricePaisa,
    buy_price_paisa: input.buyPricePaisa,
    wholesale_price_paisa: input.wholesalePricePaisa,
    stock_alert_qty: input.stockAlertMilli / 1000,
    is_service: input.isService,
    is_active: input.isActive,
  };
}

export async function createProduct(
  input: ProductInput,
  openingStockMilli: number,
  openingReason: string,
): Promise<string> {
  const sb = requireClient();

  const { data, error } = await sb
    .from('products')
    .insert(toProductRow(input))
    .select('id')
    .single();
  if (error) throw mapError(error);
  if (!data) throw new ProductApiError('unknown');

  // Opening stock is a movement, never a direct stock_qty write (PROJECT_RULES 5.4).
  if (openingStockMilli > 0) {
    await recordOpeningStock(input.tenantId, data.id, openingStockMilli, openingReason);
  }
  return data.id;
}

/**
 * Opening stock failure must not lose the product: the product exists and can be
 * stocked later from the stock screen. It is surfaced as a warning by the caller.
 */
async function recordOpeningStock(
  tenantId: string,
  productId: string,
  quantityMilli: number,
  reason: string,
) {
  const sb = requireClient();
  const { error } = await sb.rpc('record_stock_movement', {
    p_tenant: tenantId,
    p_payload: {
      client_id: crypto.randomUUID(),
      product_id: productId,
      qty_delta: quantityMilli / 1000,
      movement_type: 'opening',
      reason,
    },
  });
  if (error) {
    console.error('[products] opening stock failed', error.message);
    throw mapError(error);
  }
}

export async function updateProduct(productId: string, input: ProductInput): Promise<void> {
  const sb = requireClient();
  const { error } = await sb
    .from('products')
    .update(toProductRow(input))
    .eq('id', productId)
    .eq('tenant_id', input.tenantId);
  if (error) throw mapError(error);
}

/**
 * Soft delete / restore. The row stays so old bills keep working; the unique
 * barcode index ignores it, so the same barcode can be reused afterwards.
 */
export async function setProductDeleted(
  tenantId: string,
  productId: string,
  deleted: boolean,
): Promise<void> {
  const sb = requireClient();
  const { error } = await sb
    .from('products')
    .update({
      deleted_at: deleted ? new Date().toISOString() : null,
      is_active: !deleted,
    })
    .eq('id', productId)
    .eq('tenant_id', tenantId);
  if (error) throw mapError(error);
}

export async function createCategory(tenantId: string, name: string): Promise<string> {
  const sb = requireClient();
  const { data, error } = await sb
    .from('categories')
    .insert({ tenant_id: tenantId, name })
    .select('id')
    .single();
  if (error) throw mapError(error);
  if (!data) throw new ProductApiError('unknown');
  return data.id;
}

export async function renameCategory(categoryId: string, name: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('categories').update({ name }).eq('id', categoryId);
  if (error) throw mapError(error);
}

export async function setCategoryDeleted(categoryId: string, deleted: boolean): Promise<void> {
  const sb = requireClient();
  const { error } = await sb
    .from('categories')
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq('id', categoryId);
  if (error) throw mapError(error);
}
