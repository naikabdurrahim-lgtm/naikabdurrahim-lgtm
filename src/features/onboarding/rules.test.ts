import { describe, expect, it } from 'vitest';

import { PACKS } from '@/packs';

import { describeSampleSelection, packHasStockedProducts } from './rules';

describe('packHasStockedProducts', () => {
  it('gives restaurant and service no opening stock', () => {
    expect(packHasStockedProducts('restaurant')).toBe(false);
    expect(packHasStockedProducts('service')).toBe(false);
  });

  it('gives every shop-like pack opening stock', () => {
    for (const pack of PACKS) {
      if (pack.id === 'restaurant' || pack.id === 'service') continue;
      expect(packHasStockedProducts(pack.id)).toBe(true);
    }
  });
});

describe('describeSampleSelection', () => {
  it('shows a plain count', () => {
    expect(describeSampleSelection(0, 6)).toBe('0');
    expect(describeSampleSelection(2, 6)).toBe('2/6');
    expect(describeSampleSelection(6, 6)).toBe('6/6');
  });
});
