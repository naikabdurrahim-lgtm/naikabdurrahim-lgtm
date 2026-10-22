import { getSupabase } from '@/lib/supabase/client';
import type { BusinessPack, SampleProduct } from '@/packs';
import { packHasStockedProducts } from './rules';

export type CreateShopInput = {
  name: string;
  pack: BusinessPack;
  ownerDisplayName?: string;
  sampleProducts: SampleProduct[];
};

export class OnboardingError extends Error {
  readonly code: 'not_configured' | 'create_failed' | 'products_failed' | 'unknown';
  readonly detail?: string | undefined;

  constructor(code: OnboardingError['code'], detail?: string) {
    super(detail ?? code);
    this.name = 'OnboardingError';
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Creates the shop and its starter products.
 *
 * The shop itself is created by the `create_tenant` RPC, which also inserts the
 * owner membership, default settings and the pack's categories — all in one
 * transaction server-side.
 *
 * Starter products are a normal client insert: the owner has an INSERT policy on
 * `products` (RLS), and a missing product is a harmless, fixable outcome, so a
 * failure here must not roll back a shop that already exists.
 */
export async function createShop(input: CreateShopInput): Promise<{ tenantId: string }> {
  const sb = getSupabase();
  if (!sb) throw new OnboardingError('not_configured');

  const { data, error } = await sb.rpc('create_tenant', {
    p_name: input.name.trim(),
    p_pack: input.pack.id,
    ...(input.ownerDisplayName ? { p_owner_display_name: input.ownerDisplayName } : {}),
  });

  if (error || !data) {
    throw new OnboardingError('create_failed', error?.message);
  }

  const tenantId = data.id;

  if (input.sampleProducts.length > 0) {
    try {
      await insertSampleProducts(tenantId, input.pack, input.sampleProducts);
    } catch (error) {
      throw new OnboardingError(
        'products_failed',
        error instanceof Error ? error.message : 'unknown',
      );
    }
  }

  return { tenantId };
}

async function insertSampleProducts(
  tenantId: string,
  pack: BusinessPack,
  samples: SampleProduct[],
): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new OnboardingError('not_configured');

  // Map the pack's Bangla category names onto the rows create_tenant() inserted.
  const { data: categories, error: categoryError } = await sb
    .from('categories')
    .select('id, name')
    .eq('tenant_id', tenantId);

  if (categoryError) throw new Error(categoryError.message);

  const categoryIdByName = new Map((categories ?? []).map((c) => [c.name, c.id]));
  const stocksProducts = packHasStockedProducts(pack.id);

  const rows = samples.map((sample) => {
    const categoryId = categoryIdByName.get(sample.categoryBn) ?? null;
    return {
      tenant_id: tenantId,
      name: sample.nameBn,
      name_en: sample.nameEn,
      ...(categoryId ? { category_id: categoryId } : {}),
      unit_code: sample.unit,
      buy_price_paisa: sample.buyPaisa,
      sell_price_paisa: sample.sellPaisa,
      // Restaurant and salon items are sold without stock tracking in v1.
      is_service: !stocksProducts,
    };
  });

  const { data: created, error } = await sb.from('products').insert(rows).select('id, unit_code');

  if (error) throw new Error(error.message);

  // Opening stock must be a stock movement, never a direct write of stock_qty.
  if (!stocksProducts) return;

  const movements = (created ?? []).flatMap((product, index) => {
    const sample = samples[index];
    if (!sample || sample.stockMilli <= 0) return [];
    return [
      {
        p_tenant: tenantId,
        p_payload: {
          client_id: crypto.randomUUID(),
          product_id: product.id,
          qty_delta: sample.stockMilli / 1000,
          movement_type: 'opening' as const,
          reason: 'শুরুর মজুদ',
        },
      },
    ];
  });

  for (const movement of movements) {
    const { error: movementError } = await sb.rpc('record_stock_movement', movement);
    if (movementError) {
      // Non-fatal: the product exists, the owner can add stock from the stock screen.
      console.error('[onboarding] opening stock failed', movementError.message);
    }
  }
}
