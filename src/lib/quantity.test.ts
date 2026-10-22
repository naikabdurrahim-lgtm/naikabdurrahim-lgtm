import { describe, expect, it } from 'vitest';

import { formatQuantityMilli, MILLI_PER_UNIT, parseQuantityToMilli } from './quantity';

describe('formatQuantityMilli', () => {
  it('drops trailing zeros a shopkeeper never says out loud', () => {
    expect(formatQuantityMilli(50_000)).toBe('50');
    expect(formatQuantityMilli(2_000)).toBe('2');
    expect(formatQuantityMilli(0)).toBe('0');
  });

  it('keeps the decimals that matter', () => {
    expect(formatQuantityMilli(1_500)).toBe('1.5');
    expect(formatQuantityMilli(1_250)).toBe('1.25');
    expect(formatQuantityMilli(1_234)).toBe('1.234');
    expect(formatQuantityMilli(250)).toBe('0.25');
  });

  it('groups thousands the Bangladeshi way', () => {
    expect(formatQuantityMilli(1_234_000)).toBe('1,234');
    expect(formatQuantityMilli(12_345_000)).toBe('12,345');
  });

  it('writes Bangla numerals when asked', () => {
    expect(formatQuantityMilli(1_500, { numerals: 'bn' })).toBe('১.৫');
    expect(formatQuantityMilli(50_000, { numerals: 'bn' })).toBe('৫০');
  });

  it('keeps the minus sign in front', () => {
    expect(formatQuantityMilli(-1_500)).toBe('-1.5');
  });

  it('refuses a float — a quantity must already be in thousandths', () => {
    expect(() => formatQuantityMilli(1.5)).toThrow(TypeError);
    expect(() => formatQuantityMilli(Number.NaN)).toThrow(TypeError);
  });
});

describe('parseQuantityToMilli', () => {
  it('reads what the user types', () => {
    expect(parseQuantityToMilli('2')).toBe(2 * MILLI_PER_UNIT);
    expect(parseQuantityToMilli('1.5')).toBe(1_500);
    expect(parseQuantityToMilli('0.25')).toBe(250);
    expect(parseQuantityToMilli('1,200')).toBe(1_200_000);
    expect(parseQuantityToMilli(' 3 ')).toBe(3_000);
  });

  it('reads Bangla digits', () => {
    expect(parseQuantityToMilli('১.৫')).toBe(1_500);
    expect(parseQuantityToMilli('২')).toBe(2_000);
  });

  it('rejects what is not a quantity', () => {
    expect(parseQuantityToMilli('')).toBeNull();
    expect(parseQuantityToMilli('abc')).toBeNull();
    expect(parseQuantityToMilli('-1')).toBeNull();
    expect(parseQuantityToMilli('1.2345')).toBeNull();
    expect(parseQuantityToMilli('1.2.3')).toBeNull();
  });

  it('round-trips through the formatter', () => {
    for (const milli of [0, 250, 1_500, 50_000, 1_234_000]) {
      expect(parseQuantityToMilli(formatQuantityMilli(milli))).toBe(milli);
    }
  });
});
