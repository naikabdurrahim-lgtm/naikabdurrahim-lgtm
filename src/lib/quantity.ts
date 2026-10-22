/**
 * Quantities, in thousandths — the same scale as `numeric(14,3)` in Postgres.
 *
 * 1.5 kg is stored as 1500 and 2 pieces as 2000, never as a float. This module
 * is the display/parse half of that rule; quantities are only ever persisted as
 * integers.
 */

import { groupBangladeshi, toBanglaDigits, toEnglishDigits, type Numerals } from './money';

export const MILLI_PER_UNIT = 1000;

function assertInteger(value: number): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new TypeError(`Quantity must be an integer in thousandths, got ${value}`);
  }
}

/**
 * 50000 → "50", 1500 → "1.5", 1234000 → "1,234".
 * Trailing zeros are dropped because a shopkeeper reads "50 কেজি", not
 * "50.000 কেজি".
 */
export function formatQuantityMilli(
  quantityMilli: number,
  options: { numerals?: Numerals } = {},
): string {
  const { numerals = 'en' } = options;
  assertInteger(quantityMilli);

  const negative = quantityMilli < 0;
  const abs = Math.abs(quantityMilli);
  const whole = Math.floor(abs / MILLI_PER_UNIT);
  const fraction = String(abs % MILLI_PER_UNIT)
    .padStart(3, '0')
    .replace(/0+$/, '');

  const grouped = groupBangladeshi(String(whole));
  let out = fraction ? `${grouped}.${fraction}` : grouped;
  if (numerals === 'bn') out = toBanglaDigits(out);
  return negative ? `-${out}` : out;
}

/** Parses "1.5", "১.৫" or "1,200" into thousandths; null when invalid. */
export function parseQuantityToMilli(input: string): number | null {
  const english = toEnglishDigits(input)
    .replace(/[,\s\u00a0]/g, '')
    .trim();

  if (english === '' || !/^\d{1,9}(\.\d{1,3})?$/.test(english)) return null;

  const [whole = '0', fraction = ''] = english.split('.');
  const milli = Number(whole) * MILLI_PER_UNIT + Number(fraction.padEnd(3, '0'));
  return Number.isSafeInteger(milli) ? milli : null;
}
