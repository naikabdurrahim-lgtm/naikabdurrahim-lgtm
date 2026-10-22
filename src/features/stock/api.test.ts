import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The wire contract for stock.
 *
 * `numeric(14,3)` arrives as a string ("18.000") and the app counts thousandths,
 * so the conversion is the thing most likely to go quietly wrong. The RPC
 * payload for a movement is pinned too, because a float there would drift.
 */

const rpc = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({ rpc }),
}));

const { fetchStockMovements, fetchStockOverview, listStock, recordMovement } =
  await import('./api');

beforeEach(() => {
  vi.clearAllMocks();
});

const row = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'মিনিকেট চাল',
  unit_code: 'kg',
  stock_qty: '18.000',
  stock_alert_qty: '5.000',
  sell_price_paisa: '7500',
  buy_price_paisa: '6800',
  stock_value_paisa: '122400',
  is_service: false,
  last_movement_at: '2026-01-02T04:00:00Z',
};

describe('listStock', () => {
  it('converts the quantity string into thousandths', async () => {
    rpc.mockResolvedValue({ data: [row], error: null });

    const [item] = await listStock('tenant-1');
    expect(item).toMatchObject({ stockMilli: 18_000, alertMilli: 5_000, sellPricePaisa: 7500 });
  });

  it("keeps a cashier's missing cost as null, not zero", async () => {
    rpc.mockResolvedValue({
      data: [{ ...row, buy_price_paisa: null, stock_value_paisa: null }],
      error: null,
    });

    const [item] = await listStock('tenant-1');
    expect(item?.buyPricePaisa).toBeNull();
    expect(item?.stockValuePaisa).toBeNull();
  });

  it('passes the filter and leaves an empty search out of the call', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await listStock('tenant-1', { filter: 'low', query: '  ' });

    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(args.p_filter).toBe('low');
    expect('p_query' in args).toBe(false);
  });
});

describe('fetchStockOverview', () => {
  it('reads the single row and keeps a null value for a cashier', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          product_count: '12',
          low_stock_count: '2',
          out_of_stock_count: '1',
          stock_value_paisa: null,
        },
      ],
      error: null,
    });

    await expect(fetchStockOverview('tenant-1')).resolves.toEqual({
      productCount: 12,
      lowCount: 2,
      outCount: 1,
      valuePaisa: null,
    });
  });
});

describe('fetchStockMovements', () => {
  it('parses the running quantity as thousandths', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: '00000000-0000-0000-0000-000000000002',
          movement_type: 'sale',
          qty_delta: '-2.000',
          unit_cost_paisa: '6800',
          reason: null,
          occurred_at: '2026-01-02T04:00:00Z',
          reference_type: 'sale',
          created_by_name: 'ক্যাশিয়ার',
          running_qty: '18.000',
        },
      ],
      error: null,
    });

    const [movement] = await fetchStockMovements('tenant-1', 'product-1');
    expect(movement).toMatchObject({
      type: 'sale',
      qtyMilli: -2000,
      runningMilli: 18_000,
      createdByName: 'ক্যাশিয়ার',
    });
  });
});

describe('recordMovement', () => {
  it('sends a signed fixed-decimal quantity, never a float', async () => {
    rpc.mockResolvedValue({
      data: {
        movement_id: '00000000-0000-0000-0000-000000000003',
        product_id: '00000000-0000-0000-0000-000000000001',
        stock_qty: '17.500',
        duplicate: false,
      },
      error: null,
    });

    const result = await recordMovement('tenant-1', {
      productId: '00000000-0000-0000-0000-000000000001',
      type: 'damage',
      qtyMilli: -1500,
      unitCostPaisa: null,
      reason: 'ভেজা চাল',
      clientId: '00000000-0000-0000-0000-000000000004',
    });

    const [, args] = rpc.mock.calls[0] as [string, { p_payload: Record<string, unknown> }];
    expect(args.p_payload.qty_delta).toBe('-1.500');
    expect(args.p_payload.movement_type).toBe('damage');
    expect(args.p_payload.unit_cost_paisa).toBe(0);
    expect(result.stockMilli).toBe(17_500);
  });

  it('maps a refused cashier to a forbidden code', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'forbidden: only an owner or manager may change stock' },
    });

    await expect(
      recordMovement('tenant-1', {
        productId: 'p',
        type: 'adjustment',
        qtyMilli: 1000,
        unitCostPaisa: null,
        reason: 'গণনা',
        clientId: 'c',
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('maps a missing reason to its own code so the sheet can point at the field', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '23514', message: 'reason_required: explain why stock is being adjusted' },
    });

    await expect(
      recordMovement('tenant-1', {
        productId: 'p',
        type: 'adjustment',
        qtyMilli: 1000,
        unitCostPaisa: null,
        reason: ' ',
        clientId: 'c',
      }),
    ).rejects.toMatchObject({ code: 'reason_required' });
  });
});
