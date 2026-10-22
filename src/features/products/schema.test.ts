import { describe, expect, it } from 'vitest';

import bn from '@/locales/bn/products.json';

import { isLowStock, isOutOfStock, type Product } from './types';
import {
  buildCategorySchema,
  buildProductFormSchema,
  emptyProductForm,
  formValuesFromProduct,
  milliToInput,
  paisaToInput,
  toProductInput,
  type Translate,
} from './schema';

/**
 * Fake translator: returns the key plus any interpolated values, so a failing
 * assertion shows which rule fired without hard-coding Bangla text in the test
 * (PROJECT_RULES: never guess UI copy in tests).
 */
const t: Translate = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as Translate;

const form = buildProductFormSchema(t);
const category = buildCategorySchema(t);

const valid = {
  ...emptyProductForm('kg'),
  name: 'চাল',
  sellPrice: '75',
  buyPrice: '70',
};

describe('product form schema', () => {
  it('accepts a minimal valid product', () => {
    expect(form.safeParse(valid).success).toBe(true);
  });

  it('requires a name and a sell price', () => {
    const result = form.safeParse({ ...valid, name: '   ', sellPrice: '' });
    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map((issue) => issue.path[0]);
    expect(paths).toContain('name');
    expect(paths).toContain('sellPrice');
  });

  it('rejects a broken price but allows any number of decimals it can parse', () => {
    expect(form.safeParse({ ...valid, sellPrice: '12.345' }).success).toBe(false);
    expect(form.safeParse({ ...valid, sellPrice: '১,২০০.৫০' }).success).toBe(true);
  });

  it('treats an empty cost and empty thresholds as fine', () => {
    expect(
      form.safeParse({ ...valid, buyPrice: '', stockAlert: '', openingStock: '' }).success,
    ).toBe(true);
  });

  it('rejects a negative quantity', () => {
    expect(form.safeParse({ ...valid, openingStock: '-2' }).success).toBe(false);
  });

  it('rejects a barcode with characters a scanner never produces', () => {
    expect(form.safeParse({ ...valid, barcode: 'ABC 123' }).success).toBe(false);
    expect(form.safeParse({ ...valid, barcode: 'ABC-123_9' }).success).toBe(true);
  });

  it('rejects an over-long name with the locale message', () => {
    const result = form.safeParse({ ...valid, name: 'ক'.repeat(161) });
    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.issues[0]?.message).toContain('form.tooLong');
  });
});

describe('category schema', () => {
  it('trims and accepts a normal name', () => {
    const result = category.safeParse({ name: '  মাছ  ' });
    expect(result.success && result.data.name).toBe('মাছ');
  });

  it('requires a name', () => {
    expect(category.safeParse({ name: ' ' }).success).toBe(false);
  });

  it('caps the name length', () => {
    expect(category.safeParse({ name: 'ক'.repeat(61) }).success).toBe(false);
  });
});

describe('form ↔ stored values', () => {
  it('converts taka to paisa and kilos to thousandths', () => {
    const draft = toProductInput(
      { ...valid, sellPrice: '75.50', buyPrice: '70', openingStock: '12.5', stockAlert: '3' },
      { tenantId: 't1', isEdit: false },
    );
    expect(draft.input.sellPricePaisa).toBe(7550);
    expect(draft.input.buyPricePaisa).toBe(7000);
    expect(draft.input.stockAlertMilli).toBe(3000);
    expect(draft.openingStockMilli).toBe(12500);
    expect(draft.input.tenantId).toBe('t1');
  });

  it('never sends opening stock in edit mode', () => {
    const draft = toProductInput(
      { ...valid, openingStock: '99' },
      { tenantId: 't1', isEdit: true },
    );
    expect(draft.openingStockMilli).toBe(0);
  });

  it('zeroes opening stock for a service', () => {
    const draft = toProductInput(
      { ...valid, isService: true, openingStock: '5' },
      { tenantId: 't1', isEdit: false },
    );
    expect(draft.openingStockMilli).toBe(0);
    expect(draft.input.isService).toBe(true);
  });

  it('sends null rather than an empty string for optional columns', () => {
    const draft = toProductInput(valid, { tenantId: 't1', isEdit: false });
    expect(draft.input.barcode).toBeNull();
    expect(draft.input.sku).toBeNull();
    expect(draft.input.nameEn).toBeNull();
    expect(draft.input.wholesalePricePaisa).toBeNull();
  });

  it('renders stored values back into the form without trailing zeroes', () => {
    expect(paisaToInput(7550)).toBe('75.50');
    expect(paisaToInput(7500)).toBe('75');
    expect(paisaToInput(null)).toBe('');
    expect(milliToInput(12500)).toBe('12.5');
    expect(milliToInput(1000)).toBe('1');
    expect(milliToInput(0)).toBe('');
  });

  it('round-trips a stored product through the form', () => {
    const product: Product = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'চাল',
      nameEn: 'Rice',
      categoryId: null,
      categoryName: null,
      unitCode: 'kg',
      barcode: '123456',
      sku: null,
      sellPricePaisa: 7550,
      buyPricePaisa: 7000,
      wholesalePricePaisa: null,
      stockMilli: 12500,
      stockAlertMilli: 3000,
      isService: false,
      isActive: true,
      updatedAt: '2026-01-01T00:00:00Z',
    };
    const values = formValuesFromProduct(product, false);
    expect(values).toMatchObject({
      name: 'চাল',
      sellPrice: '75.50',
      buyPrice: '70',
      stockAlert: '3',
      openingStock: '12.5',
    });
    expect(form.safeParse(values).success).toBe(true);
  });
});

describe('stock warnings', () => {
  const base = { isService: false, stockMilli: 5000, stockAlertMilli: 5000 };

  it('warns at or below the threshold, but only when one is set', () => {
    expect(isLowStock(base)).toBe(true);
    expect(isLowStock({ ...base, stockAlertMilli: 0 })).toBe(false);
    expect(isLowStock({ ...base, stockMilli: 6000 })).toBe(false);
    expect(isLowStock({ ...base, isService: true })).toBe(false);
  });

  it('treats zero and negative stock as out of stock', () => {
    expect(isOutOfStock({ isService: false, stockMilli: 0 })).toBe(true);
    expect(isOutOfStock({ isService: false, stockMilli: 1000 })).toBe(false);
    expect(isOutOfStock({ isService: true, stockMilli: 0 })).toBe(false);
  });
});

describe('locale keys the screens rely on', () => {
  it('covers every error code the API can raise', () => {
    for (const code of [
      'duplicate_barcode',
      'duplicate_sku',
      'duplicate_category',
      'forbidden',
      'network',
      'not_found',
      'not_configured',
      'unknown',
    ]) {
      expect(bn.errors).toHaveProperty(code);
    }
  });

  it('has copy for the states a screen can land in', () => {
    for (const key of ['emptyTitle', 'emptySearchTitle', 'loadFailed', 'retry'] as const) {
      expect(bn[key].length).toBeGreaterThan(0);
    }
  });
});
