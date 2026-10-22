import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPack } from '@/packs';
import type { SampleProduct } from '@/packs';

import { createShop, OnboardingError } from './api';

/**
 * The onboarding write path is the one place where a new shop is created, so
 * every step is asserted: the RPC arguments, the category mapping, which
 * products get opening stock, and what happens when a step fails.
 */

type Result = { data: unknown; error: { message: string } | null };

type InsertedRow = {
  tenant_id: string;
  name: string;
  category_id?: string;
  unit_code: string;
  is_service?: boolean;
};

/** Records every insert so the test can inspect the rows the module builds. */
let inserted: InsertedRow[] = [];

/** Minimal stand-in for the parts of the Supabase client this module uses. */
class FakeQuery implements PromiseLike<Result> {
  constructor(
    _table: string,
    private readonly result: () => Result,
  ) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  insert(rows: InsertedRow | InsertedRow[]) {
    inserted.push(...(Array.isArray(rows) ? rows : [rows]));
    return this;
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result()).then(onfulfilled, onrejected);
  }
}

const rpc = vi.fn();
const from = vi.fn((table: string) => new FakeQuery(table, () => ({ data: null, error: null })));

const client = { rpc, from };

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => client,
}));

const sample = (overrides: Partial<SampleProduct> = {}): SampleProduct => ({
  nameBn: 'মিনিকেট চাল',
  nameEn: 'Miniket rice',
  categoryBn: 'চাল-দাল',
  unit: 'kg',
  buyPaisa: 6800,
  sellPaisa: 7500,
  stockMilli: 50000,
  ...overrides,
});

const categories = () => [
  { id: 'cat-rice', name: 'চাল-দাল' },
  { id: 'cat-other', name: 'অন্যান্য' },
];

type ProductRow = { id: string; unit_code: string };

/** Wires the happy path, with `created` as the rows `products.insert` returns. */
const happyPath = (created: ProductRow[] = [{ id: 'p1', unit_code: 'kg' }]) => {
  rpc.mockImplementation((name: string) => {
    if (name === 'create_tenant') {
      return Promise.resolve({ data: { id: 'tenant-1', name: 'দোকান' }, error: null });
    }
    return Promise.resolve({ data: { movement_id: 'm1' }, error: null });
  });
  from.mockImplementation((table: string) =>
    table === 'categories'
      ? new FakeQuery(table, () => ({ data: categories(), error: null }))
      : new FakeQuery(table, () => ({ data: created, error: null })),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  inserted = [];
});

describe('createShop', () => {
  it('calls create_tenant with the trimmed name and the pack id', async () => {
    happyPath();
    await createShop({ name: '  রহিম স্টোর  ', pack: getPack('grocery'), sampleProducts: [] });

    expect(rpc).toHaveBeenCalledWith('create_tenant', {
      p_name: 'রহিম স্টোর',
      p_pack: 'grocery',
    });
  });

  it('sends the owner name only when the user typed one', async () => {
    happyPath();
    await createShop({
      name: 'রহিম স্টোর',
      pack: getPack('grocery'),
      ownerDisplayName: 'আব্দুর রহিম',
      sampleProducts: [],
    });

    expect(rpc).toHaveBeenCalledWith('create_tenant', {
      p_name: 'রহিম স্টোর',
      p_pack: 'grocery',
      p_owner_display_name: 'আব্দুর রহিম',
    });
  });

  it('returns the tenant id and touches nothing else when no product was chosen', async () => {
    happyPath();
    const result = await createShop({
      name: 'দোকান',
      pack: getPack('grocery'),
      sampleProducts: [],
    });

    expect(result).toEqual({ tenantId: 'tenant-1' });
    expect(from).not.toHaveBeenCalled();
  });

  it('maps pack category names onto the ids create_tenant inserted', async () => {
    happyPath([
      { id: 'p1', unit_code: 'kg' },
      { id: 'p2', unit_code: 'kg' },
    ]);

    await createShop({
      name: 'দোকান',
      pack: getPack('grocery'),
      sampleProducts: [sample(), sample({ nameBn: 'চিনি', categoryBn: 'অন্যান্য' })],
    });

    expect(inserted).toHaveLength(2);
    expect(inserted[0]).toMatchObject({
      tenant_id: 'tenant-1',
      name: 'মিনিকেট চাল',
      category_id: 'cat-rice',
      unit_code: 'kg',
      is_service: false,
    });
    expect(inserted[1]).toMatchObject({ name: 'চিনি', category_id: 'cat-other' });
  });

  it('leaves the category empty rather than inventing one', async () => {
    happyPath();
    await createShop({
      name: 'দোকান',
      pack: getPack('grocery'),
      sampleProducts: [sample({ categoryBn: 'নেই' })],
    });

    expect(inserted[0]).not.toHaveProperty('category_id');
  });

  it('writes opening stock as a movement, never as a direct stock_qty', async () => {
    happyPath();
    await createShop({ name: 'দোকান', pack: getPack('grocery'), sampleProducts: [sample()] });

    const movement = rpc.mock.calls.find(([name]) => name === 'record_stock_movement');
    expect(movement).toBeDefined();

    const [, args] = movement as [string, { p_tenant: string; p_payload: Record<string, unknown> }];
    expect(args.p_tenant).toBe('tenant-1');
    expect(args.p_payload).toMatchObject({
      product_id: 'p1',
      qty_delta: 50,
      movement_type: 'opening',
    });
    expect(args.p_payload.client_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(inserted[0]).not.toHaveProperty('stock_qty');
  });

  it('skips a product that has no opening stock', async () => {
    happyPath([
      { id: 'p1', unit_code: 'kg' },
      { id: 'p2', unit_code: 'kg' },
    ]);

    await createShop({
      name: 'দোকান',
      pack: getPack('grocery'),
      sampleProducts: [sample(), sample({ nameBn: 'চিনি', stockMilli: 0 })],
    });

    const movements = rpc.mock.calls.filter(([name]) => name === 'record_stock_movement');
    expect(movements).toHaveLength(1);
  });

  it('marks a restaurant menu as a service and creates no stock movements', async () => {
    happyPath([{ id: 'p1', unit_code: 'piece' }]);
    await createShop({
      name: 'দোকান',
      pack: getPack('restaurant'),
      sampleProducts: [sample({ unit: 'piece', stockMilli: 0 })],
    });

    expect(inserted[0]?.is_service).toBe(true);
    expect(rpc.mock.calls.some(([name]) => name === 'record_stock_movement')).toBe(false);
  });

  it('treats a failed opening-stock call as non-fatal', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'create_tenant')
        return Promise.resolve({ data: { id: 'tenant-1' }, error: null });
      return Promise.resolve({ data: null, error: { message: 'movement failed' } });
    });
    from.mockImplementation((table: string) =>
      table === 'categories'
        ? new FakeQuery(table, () => ({ data: categories(), error: null }))
        : new FakeQuery(table, () => ({ data: [{ id: 'p1', unit_code: 'kg' }], error: null })),
    );

    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      createShop({ name: 'দোকান', pack: getPack('grocery'), sampleProducts: [sample()] }),
    ).resolves.toEqual({ tenantId: 'tenant-1' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('reports create_failed when the RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    await expect(
      createShop({ name: 'দোকান', pack: getPack('grocery'), sampleProducts: [] }),
    ).rejects.toMatchObject({ code: 'create_failed' });
  });

  it('reports products_failed without pretending the shop was rolled back', async () => {
    rpc.mockResolvedValue({ data: { id: 'tenant-1' }, error: null });
    from.mockImplementation(
      () => new FakeQuery('products', () => ({ data: null, error: { message: 'nope' } })),
    );

    const error = await createShop({
      name: 'দোকান',
      pack: getPack('grocery'),
      sampleProducts: [sample()],
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(OnboardingError);
    expect((error as OnboardingError).code).toBe('products_failed');
  });
});
