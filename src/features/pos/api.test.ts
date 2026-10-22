import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toSalePayload } from './cart';
import type { Cart } from './types';

/**
 * The wire contract with Postgres.
 *
 * A POS bug that only shows up against a real database is the expensive kind, so
 * the payload, the error mapping and the receipt parsing are pinned here with a
 * fake client — the SQL itself is covered by `supabase/tests/70_pos.sql`.
 */

const rpc = vi.fn();
const tables: Record<string, { data: unknown; error?: unknown }> = {};
const calls: Array<{ table: string; filters: Record<string, unknown> }> = [];

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({ rpc, from }),
}));

/** Chainable, thenable query stub — `await` works, and so does `.maybeSingle()`. */
function from(table: string) {
  const filters: Record<string, unknown> = {};
  const result = tables[table] ?? { data: null, error: null };

  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    },
    is: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };

  calls.push({ table, filters });
  return builder;
}

const { createSale, fetchPosSettings, fetchReceipt, voidSale } = await import('./api');

const cart: Cart = {
  lines: [
    {
      productId: '00000000-0000-0000-0000-000000000001',
      name: 'মিনিকেট চাল',
      unitCode: 'kg',
      isService: false,
      unitPricePaisa: 7500,
      qtyMilli: 1500,
      stockMilli: 20_000,
    },
  ],
  customer: null,
  discount: { kind: 'amount', paisa: 0 },
  method: 'cash',
  tenderedPaisa: 0,
  credit: false,
  note: '',
};

const payload = toSalePayload(
  cart,
  {
    subtotalPaisa: 11_250,
    discountPaisa: 0,
    totalPaisa: 11_250,
    paidPaisa: 11_250,
    duePaisa: 0,
    changePaisa: 0,
    itemCount: 1,
  },
  'client-id-1',
);

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  for (const key of Object.keys(tables)) delete tables[key];
});

describe('createSale', () => {
  it('sends the client id and the payload untouched', async () => {
    rpc.mockResolvedValue({
      data: {
        sale_id: '00000000-0000-0000-0000-0000000000aa',
        invoice_no: 'INV-00001',
        subtotal_paisa: 11_250,
        discount_paisa: 0,
        total_paisa: 11_250,
        paid_paisa: 11_250,
        due_paisa: 0,
        duplicate: false,
      },
      error: null,
    });

    const result = await createSale('tenant-1', payload);

    expect(rpc).toHaveBeenCalledWith('create_sale', {
      p_tenant: 'tenant-1',
      p_payload: expect.objectContaining({
        client_id: 'client-id-1',
        paid_paisa: 11_250,
        items: [{ product_id: cart.lines[0]?.productId, qty: '1.500', unit_price_paisa: 7500 }],
      }),
    });
    expect(result).toMatchObject({ invoiceNo: 'INV-00001', totalPaisa: 11_250, duplicate: false });
  });

  it('accepts the shorter payload the server returns for a duplicate', async () => {
    rpc.mockResolvedValue({
      data: {
        sale_id: '00000000-0000-0000-0000-0000000000aa',
        invoice_no: 'INV-00001',
        total_paisa: 11_250,
        paid_paisa: 11_250,
        due_paisa: 0,
        duplicate: true,
      },
      error: null,
    });

    const result = await createSale('tenant-1', payload);
    expect(result.duplicate).toBe(true);
    expect(result.subtotalPaisa).toBe(0);
  });

  it('turns a stock refusal into a code the screen can translate', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '23514', message: 'insufficient_stock: product … would drop to -1' },
    });

    await expect(createSale('tenant-1', payload)).rejects.toMatchObject({
      name: 'PosError',
      code: 'insufficient_stock',
    });
  });

  it('maps the other server refusals it can explain', async () => {
    const cases: Array<[string, string]> = [
      ['below_cost_not_allowed: চাল is sold below its cost price', 'below_cost_not_allowed'],
      [
        'discount_not_allowed: only an owner or manager may give a discount',
        'discount_not_allowed',
      ],
      [
        'due_requires_customer: choose a customer before selling on credit',
        'due_requires_customer',
      ],
      ['permission denied for function create_sale', 'forbidden'],
      ['TypeError: Failed to fetch', 'network'],
      ['something nobody predicted', 'unknown'],
    ];

    for (const [message, code] of cases) {
      rpc.mockResolvedValueOnce({ data: null, error: { message } });
      await expect(createSale('tenant-1', payload)).rejects.toMatchObject({ code });
    }
  });
});

describe('voidSale', () => {
  it('passes the reason through and reports an idempotent void', async () => {
    rpc.mockResolvedValue({
      data: { sale_id: '00000000-0000-0000-0000-0000000000aa', already_voided: true },
      error: null,
    });

    const result = await voidSale(
      'tenant-1',
      '00000000-0000-0000-0000-0000000000aa',
      'ভুল হয়ে গেছে',
    );

    expect(rpc).toHaveBeenCalledWith('void_sale', {
      p_tenant: 'tenant-1',
      p_sale_id: '00000000-0000-0000-0000-0000000000aa',
      p_reason: 'ভুল হয়ে গেছে',
    });
    expect(result.alreadyVoided).toBe(true);
  });
});

describe('fetchReceipt', () => {
  it('reads the header, the receipt-safe lines and the shop footer', async () => {
    tables.sales = {
      data: {
        id: '00000000-0000-0000-0000-0000000000aa',
        invoice_no: 'INV-00007',
        created_at: '2026-01-15T10:00:00.000Z',
        business_date: '2026-01-15',
        status: 'completed',
        customer_id: '00000000-0000-0000-0000-0000000000cc',
        subtotal_paisa: 11_250,
        discount_paisa: 1250,
        discount_kind: 'percent',
        total_paisa: 10_000,
        paid_paisa: 4000,
        due_paisa: 6000,
        note: null,
      },
    };
    tables.v_sale_items_receipt = {
      data: [
        {
          id: '00000000-0000-0000-0000-0000000000ab',
          name_snapshot: 'মিনিকেট চাল',
          unit_code: 'kg',
          qty: '1.500',
          unit_price_paisa: 7500,
          discount_paisa: 0,
          line_total_paisa: 11_250,
          sort_order: 0,
        },
      ],
    };
    tables.customers = { data: { name: 'রহিম ভাই' } };
    tables.app_settings = { data: { receipt_footer: 'আবার আসবেন।' } };

    const receipt = await fetchReceipt('tenant-1', '00000000-0000-0000-0000-0000000000aa');

    expect(receipt).toMatchObject({
      invoiceNo: 'INV-00007',
      customerName: 'রহিম ভাই',
      footer: 'আবার আসবেন।',
      totalPaisa: 10_000,
      duePaisa: 6000,
      discountKind: 'percent',
    });
    // numeric(14,3) must become integer thousandths, never a float.
    expect(receipt?.items[0]).toMatchObject({ qtyMilli: 1500, lineTotalPaisa: 11_250 });
  });

  it('returns null for a sale that is not in this shop', async () => {
    tables.sales = { data: null };
    await expect(fetchReceipt('tenant-1', 'missing')).resolves.toBeNull();
  });
});

describe('fetchPosSettings', () => {
  it('falls back to safe defaults so a settings hiccup never blocks a sale', async () => {
    tables.app_settings = { data: null, error: { message: 'boom' } };
    await expect(fetchPosSettings('tenant-1')).resolves.toEqual({
      receiptFooter: '',
      receiptHeader: null,
      allowCashierDiscount: true,
      allowNegativeStock: false,
    });
  });

  it('reads the shop settings when they are there', async () => {
    tables.app_settings = {
      data: {
        receipt_footer: 'ধন্যবাদ',
        receipt_header: 'আমার দোকান',
        allow_cashier_discount: false,
        allow_negative_stock: true,
      },
    };
    await expect(fetchPosSettings('tenant-1')).resolves.toEqual({
      receiptFooter: 'ধন্যবাদ',
      receiptHeader: 'আমার দোকান',
      allowCashierDiscount: false,
      allowNegativeStock: true,
    });
  });
});
