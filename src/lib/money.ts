/**
 * Money is ALWAYS an integer number of paisa (1 taka = 100 paisa).
 * Never use floating point for money anywhere in the app — convert at the
 * display layer with the helpers below (PROJECT_RULES 5.3).
 */

export const PAISA_PER_TAKA = 100;

/** Bangla digits for display-only conversion. */
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

export type Numerals = 'bn' | 'en';

/** Convert ASCII digits in a string to Bangla digits. Leaves other chars untouched. */
export function toBanglaDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

/** Convert Bangla digits in a string back to ASCII digits. */
export function toEnglishDigits(value: string): string {
  return value.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d as (typeof BN_DIGITS)[number])));
}

/**
 * Parse user input into paisa. Accepts "12", "12.5", "12.50", "৳ 12.5",
 * "১২.৫০", and commas ("1,200.50"). Returns `null` when the input is not a
 * valid non-negative money value with at most 2 decimal places.
 */
export function parseTakaToPaisa(input: string | number): number | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null;
    // Round to paisa; avoids 12.29 * 100 = 1228.9999...
    const paisa = Math.round(input * PAISA_PER_TAKA);
    return Math.abs(paisa / PAISA_PER_TAKA - input) < 1e-9 ? paisa : null;
  }

  const normalised = toEnglishDigits(input)
    .replace(/[৳,\s\u00a0]/g, '')
    .trim();

  if (normalised === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null;

  const [whole, frac = ''] = normalised.split('.');
  const paisa = Number(whole) * PAISA_PER_TAKA + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(paisa) ? paisa : null;
}

/** Convert paisa to taka as a number. Only for charts/analytics, never for storage. */
export function paisaToTaka(paisa: number): number {
  assertInteger(paisa);
  return paisa / PAISA_PER_TAKA;
}

/**
 * Format paisa for display with Bangladeshi digit grouping (lakh/crore style is
 * the local convention: 12,34,567.89).
 */
export function formatPaisa(
  paisa: number,
  options: { numerals?: Numerals; withSymbol?: boolean; showDecimals?: boolean } = {},
): string {
  const { numerals = 'en', withSymbol = true, showDecimals = true } = options;
  assertInteger(paisa);

  const negative = paisa < 0;
  const abs = Math.abs(paisa);
  const whole = Math.floor(abs / PAISA_PER_TAKA);
  const fraction = abs % PAISA_PER_TAKA;

  const wholeStr = groupBangladeshi(String(whole));
  const fractionStr = String(fraction).padStart(2, '0');

  let out = showDecimals && fraction !== 0 ? `${wholeStr}.${fractionStr}` : wholeStr;
  // The minus sign goes before the currency symbol: -৳12.50 (Bangla convention).
  if (withSymbol) out = `৳${out}`;
  if (negative) out = `-${out}`;
  if (numerals === 'bn') out = toBanglaDigits(out);
  return out;
}

/** Bangladeshi grouping: last 3 digits, then groups of 2 (12,34,567). */
export function groupBangladeshi(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${grouped},${last3}`;
}

/** Sum paisa values safely, throwing on non-integers instead of silently drifting. */
export function sumPaisa(values: readonly number[]): number {
  return values.reduce((total, value) => {
    assertInteger(value, 'sumPaisa received a non-integer amount');
    return total + value;
  }, 0);
}

/**
 * Apply a discount given as either an amount in paisa or a percentage (0-100).
 * Percentage results are rounded to the nearest paisa using half-up rounding so
 * totals stay deterministic.
 */
export function calcDiscount(
  subtotalPaisa: number,
  discount: { type: 'amount'; valuePaisa: number } | { type: 'percent'; valuePercent: number },
): number {
  assertInteger(subtotalPaisa, 'Subtotal must be an integer paisa value');
  if (subtotalPaisa < 0) throw new RangeError('Subtotal cannot be negative');

  if (discount.type === 'amount') {
    assertInteger(discount.valuePaisa, 'Discount amount must be an integer paisa value');
    if (discount.valuePaisa < 0) throw new RangeError('Discount cannot be negative');
    return Math.min(discount.valuePaisa, subtotalPaisa);
  }

  const { valuePercent } = discount;
  if (!Number.isFinite(valuePercent) || valuePercent < 0 || valuePercent > 100) {
    throw new RangeError('Discount percent must be between 0 and 100');
  }
  return Math.round((subtotalPaisa * valuePercent) / 100);
}

/**
 * Line total for quantity × unit price. Quantity is in thousandths (matching
 * numeric(14,3) in Postgres), so 1.5 kg = 1500.
 */
export function lineTotalPaisa(unitPricePaisa: number, quantityMilli: number): number {
  assertInteger(unitPricePaisa, 'Unit price must be integer paisa');
  assertInteger(quantityMilli, 'Quantity must be an integer (thousandths)');
  if (unitPricePaisa < 0 || quantityMilli < 0) throw new RangeError('Negative values not allowed');
  return Math.round((unitPricePaisa * quantityMilli) / 1000);
}

/** Cost/profit for a sale line: (sell - buy) × qty, in paisa. */
export function profitPaisa(
  sellPricePaisa: number,
  buyPricePaisa: number,
  quantityMilli: number,
): number {
  return (
    lineTotalPaisa(sellPricePaisa, quantityMilli) - lineTotalPaisa(buyPricePaisa, quantityMilli)
  );
}

function assertInteger(value: number, message = 'Money must be an integer paisa value'): void {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${message}: received ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${message}: value exceeds safe integer range`);
  }
}
