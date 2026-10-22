import { describe, expect, it } from 'vitest';
import {
  calcDiscount,
  formatPaisa,
  groupBangladeshi,
  lineTotalPaisa,
  parseTakaToPaisa,
  paisaToTaka,
  profitPaisa,
  sumPaisa,
  toBanglaDigits,
  toEnglishDigits,
} from './money';

describe('parseTakaToPaisa', () => {
  it('parses whole taka', () => {
    expect(parseTakaToPaisa('12')).toBe(1200);
    expect(parseTakaToPaisa('0')).toBe(0);
  });

  it('parses decimals without floating point drift', () => {
    expect(parseTakaToPaisa('12.29')).toBe(1229);
    expect(parseTakaToPaisa('0.05')).toBe(5);
    expect(parseTakaToPaisa('12.5')).toBe(1250);
  });

  it('parses Bangla digits, currency symbol, spaces and commas', () => {
    expect(parseTakaToPaisa('১২.৫০')).toBe(1250);
    expect(parseTakaToPaisa('৳ 1,200.50')).toBe(120050);
    expect(parseTakaToPaisa(' 99 ')).toBe(9900);
  });

  it('accepts numbers that map exactly onto paisa', () => {
    expect(parseTakaToPaisa(12.5)).toBe(1250);
  });

  it('rejects invalid input', () => {
    expect(parseTakaToPaisa('')).toBeNull();
    expect(parseTakaToPaisa('abc')).toBeNull();
    expect(parseTakaToPaisa('-5')).toBeNull();
    expect(parseTakaToPaisa('1.234')).toBeNull();
    // Commas are stripped wherever they appear, so shopkeepers can paste
    // "1,23,456" or "12,34" from anywhere without an error.
    expect(parseTakaToPaisa('1,23,456')).toBe(12345600);
    expect(parseTakaToPaisa(Number.NaN)).toBeNull();
    expect(parseTakaToPaisa(12.345)).toBeNull();
  });
});

describe('formatPaisa', () => {
  it('formats with the taka symbol and hides .00 for whole amounts', () => {
    expect(formatPaisa(1200)).toBe('৳12');
    expect(formatPaisa(1250)).toBe('৳12.50');
    expect(formatPaisa(5)).toBe('৳0.05');
  });

  it('groups digits the Bangladeshi way', () => {
    expect(formatPaisa(12345678)).toBe('৳1,23,456.78');
    expect(formatPaisa(100000)).toBe('৳1,000');
  });

  it('supports Bangla numerals', () => {
    expect(formatPaisa(1250, { numerals: 'bn' })).toBe('৳১২.৫০');
  });

  it('supports negatives and options', () => {
    expect(formatPaisa(-1250)).toBe('-৳12.50');
    expect(formatPaisa(1250, { withSymbol: false })).toBe('12.50');
    expect(formatPaisa(1200, { showDecimals: true })).toBe('৳12');
  });

  it('rejects non-integer paisa', () => {
    expect(() => formatPaisa(12.5)).toThrow(TypeError);
  });
});

describe('groupBangladeshi', () => {
  it('groups correctly', () => {
    expect(groupBangladeshi('1')).toBe('1');
    expect(groupBangladeshi('999')).toBe('999');
    expect(groupBangladeshi('1000')).toBe('1,000');
    expect(groupBangladeshi('123456')).toBe('1,23,456');
    expect(groupBangladeshi('12345678')).toBe('1,23,45,678');
  });
});

describe('digit conversion', () => {
  it('round-trips between scripts', () => {
    expect(toBanglaDigits('0123456789')).toBe('০১২৩৪৫৬৭৮৯');
    expect(toEnglishDigits('০১২৩৪৫৬৭৮৯')).toBe('0123456789');
    expect(toEnglishDigits(toBanglaDigits('৳12.50'))).toBe('৳12.50');
  });
});

describe('sumPaisa / paisaToTaka', () => {
  it('sums integer paisa', () => {
    expect(sumPaisa([100, 250, 5])).toBe(355);
    expect(sumPaisa([])).toBe(0);
  });

  it('throws on floating point amounts', () => {
    expect(() => sumPaisa([100, 0.5])).toThrow(TypeError);
  });

  it('converts to taka for display', () => {
    expect(paisaToTaka(1250)).toBe(12.5);
  });
});

describe('calcDiscount', () => {
  it('caps amount discounts at the subtotal', () => {
    expect(calcDiscount(1000, { type: 'amount', valuePaisa: 200 })).toBe(200);
    expect(calcDiscount(1000, { type: 'amount', valuePaisa: 5000 })).toBe(1000);
  });

  it('rounds percent discounts to whole paisa', () => {
    expect(calcDiscount(999, { type: 'percent', valuePercent: 10 })).toBe(100);
    expect(calcDiscount(1200, { type: 'percent', valuePercent: 12.5 })).toBe(150);
  });

  it('validates bounds', () => {
    expect(() => calcDiscount(-1, { type: 'amount', valuePaisa: 1 })).toThrow(RangeError);
    expect(() => calcDiscount(100, { type: 'percent', valuePercent: 101 })).toThrow(RangeError);
    expect(() => calcDiscount(100, { type: 'amount', valuePaisa: -1 })).toThrow(RangeError);
  });
});

describe('lineTotalPaisa / profitPaisa', () => {
  it('multiplies fractional quantities without drift', () => {
    expect(lineTotalPaisa(1250, 1500)).toBe(1875); // 12.50 × 1.5
    expect(lineTotalPaisa(100, 333)).toBe(33); // rounds 33.3
    expect(lineTotalPaisa(0, 5000)).toBe(0);
  });

  it('computes profit', () => {
    expect(profitPaisa(1250, 1000, 2000)).toBe(500);
    expect(profitPaisa(1000, 1250, 1000)).toBe(-250);
  });

  it('rejects negative inputs', () => {
    expect(() => lineTotalPaisa(-1, 1000)).toThrow(RangeError);
    expect(() => lineTotalPaisa(1000, -1)).toThrow(RangeError);
  });
});
