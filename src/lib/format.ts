import { groupBangladeshi, toBanglaDigits, type Numerals } from './money';

/**
 * Plain integers (counts, item tallies) for places that need a string rather
 * than the NumberText component — an interpolation into a sentence, for example.
 * Bangladeshi grouping, because 12,34,567 is how the number would be read here.
 */
export function formatInteger(value: number, numerals: Numerals = 'en'): string {
  const safe = Number.isFinite(value) ? Math.trunc(value) : 0;
  const grouped = groupBangladeshi(String(Math.abs(safe)));
  const text = safe < 0 ? `-${grouped}` : grouped;
  return numerals === 'bn' ? toBanglaDigits(text) : text;
}
