import { toBanglaDigits, type Numerals } from './money';

/**
 * Dates in the shop's timezone.
 *
 * The database stores `timestamptz` in UTC (PROJECT_RULES 5.2); every human sees
 * Asia/Dhaka. Formatting is centralised here so a receipt, a report and a
 * "today" header can never disagree about what day it is.
 */

export const SHOP_TIME_ZONE = 'Asia/Dhaka';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: SHOP_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: SHOP_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

function present(value: string, formatter: Intl.DateTimeFormat, numerals: Numerals): string {
  const date = new Date(value);
  // A bad timestamp must not break a receipt: fall back to the raw value.
  if (Number.isNaN(date.getTime())) return value;
  const text = formatter.format(date);
  return numerals === 'bn' ? toBanglaDigits(text) : text;
}

export function formatDhakaDate(iso: string, numerals: Numerals = 'bn'): string {
  return present(iso, dateFormatter, numerals);
}

export function formatDhakaDateTime(iso: string, numerals: Numerals = 'bn'): string {
  return present(iso, dateTimeFormatter, numerals);
}

/** `YYYY-MM-DD` in Dhaka, for "today's sales" queries. */
export function dhakaBusinessDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts;
}
