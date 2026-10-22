import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchRecentSales,
  fetchSalesReport,
  fetchToday,
  fetchTopProducts,
  rangeDates,
} from './api';
import { maxOf, totalsOf } from './types';

/**
 * The reports read what the database computed. What matters on this side is
 * that `null` profit survives the trip as `null` (not 0), that dates line up
 * with Dhaka, and that a refused cashier is a code the UI can explain.
 */

const rpc = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({ rpc }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchToday', () => {
  it('reads the jsonb summary and keeps a null profit', async () => {
    rpc.mockResolvedValue({
      data: {
        business_date: '2026-10-22',
        sale_count: 4,
        sales_paisa: 120000,
        credit_given_paisa: 30000,
        collected_paisa: 5000,
        profit_paisa: null,
      },
      error: null,
    });

    await expect(fetchToday('tenant-1')).resolves.toEqual({
      businessDate: '2026-10-22',
      saleCount: 4,
      salesPaisa: 120000,
      creditPaisa: 30000,
      collectedPaisa: 5000,
      profitPaisa: null,
    });
  });

  it('leaves the date out when the caller wants today', async () => {
    rpc.mockResolvedValue({
      data: {
        business_date: '2026-10-22',
        sale_count: 0,
        sales_paisa: 0,
        credit_given_paisa: 0,
        collected_paisa: 0,
        profit_paisa: 0,
      },
      error: null,
    });

    await fetchToday('tenant-1');
    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect('p_date' in args).toBe(false);
  });
});

describe('fetchSalesReport', () => {
  it('parses the daily rows', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          business_date: '2026-10-21',
          sale_count: '2',
          sales_paisa: '30000',
          credit_paisa: '10000',
          collected_paisa: '0',
          profit_paisa: '4000',
        },
      ],
      error: null,
    });

    const [day] = await fetchSalesReport('tenant-1', '2026-10-21', '2026-10-22');
    expect(day).toEqual({
      date: '2026-10-21',
      saleCount: 2,
      salesPaisa: 30000,
      creditPaisa: 10000,
      collectedPaisa: 0,
      profitPaisa: 4000,
    });
  });

  it('maps the owner-only refusal to a code', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'forbidden: reports are for the owner and manager' },
    });

    await expect(fetchSalesReport('tenant-1', '2026-10-01', '2026-10-22')).rejects.toMatchObject({
      code: 'forbidden',
    });
  });
});

describe('fetchRecentSales', () => {
  it('keeps a voided sale visible but marked', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          invoice_no: 'INV-00007',
          total_paisa: '11250',
          due_paisa: '0',
          status: 'voided',
          business_date: '2026-10-22',
          created_at: '2026-10-22T09:00:00Z',
          customer_name: null,
          item_count: '2',
        },
      ],
      error: null,
    });

    const [sale] = await fetchRecentSales('tenant-1');
    expect(sale).toMatchObject({ invoiceNo: 'INV-00007', status: 'voided', itemCount: 2 });
  });
});

describe('fetchTopProducts', () => {
  it('turns the quantity into thousandths', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          product_id: '00000000-0000-0000-0000-000000000002',
          name: 'মিনিকেট চাল',
          qty: '13.500',
          revenue_paisa: '101250',
          profit_paisa: '9450',
          sale_count: '6',
        },
      ],
      error: null,
    });

    const [top] = await fetchTopProducts('tenant-1', '2026-10-01', '2026-10-22');
    expect(top).toMatchObject({ name: 'মিনিকেট চাল', qtyMilli: 13_500, revenuePaisa: 101250 });
  });
});

describe('rangeDates', () => {
  // 2026-10-22 18:00 UTC is 2026-10-23 00:00 in Dhaka: the range must follow the
  // shop's clock, not the server's.
  const now = new Date('2026-10-22T18:00:00Z');

  it('ends the range on the Dhaka date', () => {
    expect(rangeDates('week', now).to).toBe('2026-10-23');
  });

  it('covers seven days including today', () => {
    expect(rangeDates('week', now)).toEqual({ from: '2026-10-17', to: '2026-10-23' });
  });

  it('covers thirty days for a month', () => {
    expect(rangeDates('month', now)).toEqual({ from: '2026-09-24', to: '2026-10-23' });
  });

  it('is a single day for "today"', () => {
    expect(rangeDates('today', now)).toEqual({ from: '2026-10-23', to: '2026-10-23' });
  });
});

describe('totalsOf', () => {
  it('adds up the days it was given', () => {
    const totals = totalsOf([
      {
        date: '2026-10-21',
        saleCount: 2,
        salesPaisa: 30000,
        creditPaisa: 10000,
        collectedPaisa: 0,
        profitPaisa: 4000,
      },
      {
        date: '2026-10-22',
        saleCount: 3,
        salesPaisa: 45000,
        creditPaisa: 0,
        collectedPaisa: 5000,
        profitPaisa: 6000,
      },
    ]);

    expect(totals).toEqual({
      saleCount: 5,
      salesPaisa: 75000,
      profitPaisa: 10000,
      creditPaisa: 10000,
      collectedPaisa: 5000,
    });
  });

  it('is all zeroes for an empty range, never NaN', () => {
    expect(totalsOf([])).toEqual({
      saleCount: 0,
      salesPaisa: 0,
      profitPaisa: 0,
      creditPaisa: 0,
      collectedPaisa: 0,
    });
  });
});

describe('maxOf', () => {
  it('finds the tallest bar', () => {
    expect(maxOf([0, 120, 40])).toBe(120);
    expect(maxOf([])).toBe(0);
  });
});
