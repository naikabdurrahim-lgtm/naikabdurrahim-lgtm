/**
 * The numbers on the today screen and in the reports.
 *
 * Profit is `null` — never 0 — when the caller may not see it. A zero would
 * read as "you made nothing today", which is a different and much worse lie
 * than "you are not allowed to see this".
 */

export type TodaySummary = {
  businessDate: string;
  saleCount: number;
  salesPaisa: number;
  creditPaisa: number;
  collectedPaisa: number;
  /** `null` for a cashier. */
  profitPaisa: number | null;
};

export type DayPoint = {
  date: string;
  saleCount: number;
  salesPaisa: number;
  creditPaisa: number;
  collectedPaisa: number;
  profitPaisa: number;
};

export type TopProduct = {
  productId: string;
  name: string;
  qtyMilli: number;
  revenuePaisa: number;
  profitPaisa: number;
  saleCount: number;
};

export type RecentSale = {
  id: string;
  invoiceNo: string | null;
  totalPaisa: number;
  duePaisa: number;
  status: 'completed' | 'voided';
  businessDate: string;
  createdAt: string;
  customerName: string | null;
  itemCount: number;
};

/** The ranges the report screen offers. A custom range is Phase 10. */
export type ReportRange = 'today' | 'week' | 'month';

export type ReportApiErrorCode = 'forbidden' | 'not_configured' | 'network' | 'unknown';

export class ReportApiError extends Error {
  readonly code: ReportApiErrorCode;
  readonly detail: string | undefined;

  constructor(code: ReportApiErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = 'ReportApiError';
    this.code = code;
    this.detail = detail;
  }
}

/** Sums for the header of a range, computed from the daily rows. */
export function totalsOf(days: readonly DayPoint[]): {
  salesPaisa: number;
  profitPaisa: number;
  creditPaisa: number;
  collectedPaisa: number;
  saleCount: number;
} {
  return days.reduce(
    (acc, day) => ({
      salesPaisa: acc.salesPaisa + day.salesPaisa,
      profitPaisa: acc.profitPaisa + day.profitPaisa,
      creditPaisa: acc.creditPaisa + day.creditPaisa,
      collectedPaisa: acc.collectedPaisa + day.collectedPaisa,
      saleCount: acc.saleCount + day.saleCount,
    }),
    { salesPaisa: 0, profitPaisa: 0, creditPaisa: 0, collectedPaisa: 0, saleCount: 0 },
  );
}

/** The tallest bar in a series, or 0 so the caller never divides by zero. */
export function maxOf(values: readonly number[]): number {
  return values.reduce((max, value) => (value > max ? value : max), 0);
}
