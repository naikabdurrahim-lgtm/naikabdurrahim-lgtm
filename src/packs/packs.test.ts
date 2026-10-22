import { describe, expect, it } from 'vitest';

import { getPack, hasModule, isPackId, PACKS } from './index';
import type { BusinessPack } from './types';

/**
 * Packs are data. Bad data here shows up as a broken onboarding for a shop
 * we have never seen, so every invariant is asserted rather than assumed.
 */
describe('registry', () => {
  it('offers all six business types, most common first', () => {
    expect(PACKS.map((pack) => pack.id)).toEqual([
      'grocery',
      'pharmacy',
      'clothing',
      'restaurant',
      'service',
      'general',
    ]);
  });

  it('has unique ids and Bangla labels', () => {
    expect(new Set(PACKS.map((pack) => pack.id)).size).toBe(PACKS.length);
    for (const pack of PACKS) {
      expect(pack.labelBn.trim().length).toBeGreaterThan(0);
      expect(pack.labelBn).toMatch(/[\u0980-\u09FF]/);
      expect(pack.labelEn.trim().length).toBeGreaterThan(0);
    }
  });

  it('falls back to the general pack for unknown or missing input', () => {
    expect(getPack('nope').id).toBe('general');
    expect(getPack(null).id).toBe('general');
    expect(getPack(undefined).id).toBe('general');
    expect(getPack('').id).toBe('general');
    expect(getPack('pharmacy').id).toBe('pharmacy');
  });

  it('narrows untrusted values with isPackId', () => {
    for (const pack of PACKS) expect(isPackId(pack.id)).toBe(true);
    expect(isPackId('supermarket')).toBe(false);
    expect(isPackId(null)).toBe(false);
    expect(isPackId(7)).toBe(false);
  });
});

describe.each(PACKS.map((pack) => [pack.id, pack] as const))('pack %s', (_id, pack) => {
  const data: BusinessPack = pack;

  it('declares the modules the product depends on', () => {
    // PROJECT_RULES 5.2 — restaurant and service are configuration-only in v1.
    if (data.id === 'restaurant' || data.id === 'service') {
      expect(data.modules).toEqual([]);
    }
    expect(hasModule(data, 'barcode')).toBe(
      data.id === 'pharmacy' || data.id === 'clothing' || data.id === 'general',
    );
    expect(hasModule(data, 'batches')).toBe(data.id === 'pharmacy');
  });

  it('uses only known unit codes', () => {
    const known = [
      'piece',
      'dozen',
      'packet',
      'strip',
      'box',
      'bottle',
      'kg',
      'gram',
      'litre',
      'ml',
    ];
    for (const unit of data.defaultUnits) expect(known).toContain(unit);
    expect(data.defaultUnits.length).toBeGreaterThan(0);
  });

  it('has no duplicate default category names', () => {
    const names = data.defaultCategories.map((category) => category.nameBn);
    expect(new Set(names).size).toBe(names.length);
  });

  it('offers starter products a shopkeeper would recognise', () => {
    expect(data.sampleProducts.length).toBeGreaterThanOrEqual(3);
    expect(data.sampleProducts.length).toBeLessThanOrEqual(8);
  });

  it('keeps every starter product internally consistent', () => {
    const categories = new Set(data.defaultCategories.map((category) => category.nameBn));

    for (const product of data.sampleProducts) {
      expect(product.nameBn).toMatch(/[\u0980-\u09FF]/);
      expect(product.nameEn.trim().length).toBeGreaterThan(0);
      // The product's category must exist, or onboarding inserts an orphan.
      expect(categories).toContain(product.categoryBn);
      expect(data.defaultUnits).toContain(product.unit);

      // Integer paisa, never a float (PROJECT_RULES 5.3).
      expect(Number.isInteger(product.buyPaisa)).toBe(true);
      expect(Number.isInteger(product.sellPaisa)).toBe(true);
      expect(Number.isInteger(product.stockMilli)).toBe(true);

      // A salon service (haircut) has no material cost, so 0 is valid there;
      // a physical product always costs something to buy.
      const servicePriced = data.id === 'service';
      if (servicePriced) {
        expect(product.buyPaisa).toBeGreaterThanOrEqual(0);
      } else {
        expect(product.buyPaisa).toBeGreaterThan(0);
      }

      // Selling below cost is allowed in a clearance, but a starter product
      // should never be a loss from day one.
      expect(product.sellPaisa).toBeGreaterThanOrEqual(product.buyPaisa);
      expect(product.sellPaisa).toBeGreaterThan(0);

      // Restaurant menus and salon services are sold without a stock count.
      if (data.id === 'restaurant' || data.id === 'service') {
        expect(product.stockMilli).toBe(0);
      } else {
        expect(product.stockMilli).toBeGreaterThan(0);
      }
    }
  });

  it('has no duplicate starter product', () => {
    const names = data.sampleProducts.map((product) => product.nameBn);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps terminology short enough for the UI', () => {
    // These strings sit inside 48px buttons; anything long overflows.
    expect(data.terminology.product.length).toBeLessThanOrEqual(20);
    expect(data.terminology.products.length).toBeLessThanOrEqual(20);
    expect(data.terminology.sale.length).toBeLessThanOrEqual(20);
  });
});
