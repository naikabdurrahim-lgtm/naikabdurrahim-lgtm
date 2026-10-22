import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/lib/i18n';
import bn from '@/locales/bn/common.json';
import { usePreferences } from '@/features/settings/preferences';

import { HomePage } from './HomePage';

/**
 * Simple Mode is four big buttons and nothing else (PROJECT_RULES 3.1 #4), and
 * the dashboard must never invent a number it has not been given.
 */

let role: 'owner' | 'cashier' = 'owner';

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ activeTenant: { tenantId: 'tenant-1', role } }),
}));

const useToday = vi.fn();
const useDueSummary = vi.fn();
const useStockOverview = vi.fn();

vi.mock('@/features/reports/queries', () => ({ useToday: () => useToday() }));
vi.mock('@/features/customers/queries', () => ({ useDueSummary: () => useDueSummary() }));
vi.mock('@/features/stock/queries', () => ({ useStockOverview: () => useStockOverview() }));

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <HomePage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  role = 'owner';
  usePreferences.setState({ mode: 'simple' });

  useToday.mockReturnValue({
    data: {
      businessDate: '2026-10-22',
      saleCount: 3,
      salesPaisa: 12500,
      creditPaisa: 4000,
      collectedPaisa: 2000,
      profitPaisa: 3100,
    },
    isPending: false,
  });
  useDueSummary.mockReturnValue({
    data: { totalDuePaisa: 6000, debtorCount: 1, customerCount: 2, oldestDueAt: null },
    isPending: false,
  });
  useStockOverview.mockReturnValue({
    data: { productCount: 12, lowCount: 1, outCount: 1, valuePaisa: 450000 },
    isPending: false,
  });
});

describe('HomePage', () => {
  it('offers exactly the four primary actions in Simple Mode', () => {
    renderHome();

    for (const label of [bn.nav.sell, bn.nav.due, bn.nav.stock, bn.nav.today]) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeTruthy();
    }
    expect(screen.getByRole('link', { name: new RegExp(bn.nav.due) }).getAttribute('href')).toBe(
      '/due',
    );
  });

  it('shows the real day on the dashboard in Pro Mode', () => {
    usePreferences.setState({ mode: 'pro' });
    renderHome();

    expect(screen.getByText(bn.home.todaysSales)).toBeTruthy();
    expect(screen.getAllByText('৳১২৫').length).toBeGreaterThan(0);
    expect(screen.getAllByText('৳৬০').length).toBeGreaterThan(0);
    expect(screen.getByText(bn.home.todaysProfit)).toBeTruthy();
  });

  it('gives a cashier collections instead of profit', () => {
    usePreferences.setState({ mode: 'pro' });
    role = 'cashier';
    useToday.mockReturnValue({
      data: {
        businessDate: '2026-10-22',
        saleCount: 3,
        salesPaisa: 12500,
        creditPaisa: 4000,
        collectedPaisa: 2000,
        profitPaisa: null,
      },
      isPending: false,
    });

    renderHome();

    expect(screen.queryByText(bn.home.todaysProfit)).toBeNull();
    expect(screen.getByText(bn.home.todaysCollected)).toBeTruthy();
  });

  it('nudges towards the stock screen when something is running out', () => {
    renderHome();

    const nudge = screen.getByRole('link', { name: new RegExp(bn.home.lowStockLabel) });
    expect(nudge.getAttribute('href')).toBe('/stock');
  });

  it('stays quiet when no product needs restocking', () => {
    useStockOverview.mockReturnValue({
      data: { productCount: 12, lowCount: 0, outCount: 0, valuePaisa: 450000 },
      isPending: false,
    });

    renderHome();
    expect(screen.queryByText(new RegExp(bn.home.lowStockLabel))).toBeNull();
  });

  it('shows skeletons, never a fake ৳০, while the numbers are loading', () => {
    usePreferences.setState({ mode: 'pro' });
    useToday.mockReturnValue({ data: undefined, isPending: true });
    useDueSummary.mockReturnValue({ data: undefined, isPending: true });
    useStockOverview.mockReturnValue({ data: undefined, isPending: true });

    renderHome();

    // No amount at all is better than a made-up ৳০.
    expect(screen.queryByText(/৳/)).toBeNull();
  });
});
