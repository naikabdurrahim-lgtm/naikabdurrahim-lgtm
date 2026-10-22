import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/lib/i18n';
import bn from '@/locales/bn/stock.json';

import { StockPage } from './StockPage';

/**
 * The stock screen as the shopkeeper meets it: what is finished on top, what it
 * is worth, and a way to fix a count — for the roles that may.
 */

const useStock = vi.fn();
const useStockOverview = vi.fn();
const recordAsync = vi.fn();

vi.mock('../queries', () => ({
  useStock: (...args: unknown[]) => useStock(...args),
  useStockOverview: (...args: unknown[]) => useStockOverview(...args),
  useRecordMovement: () => ({ mutateAsync: recordAsync, isPending: false }),
}));

let role: 'owner' | 'cashier' = 'owner';
vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ activeTenant: { tenantId: 'tenant-1', role } }),
}));

const oil = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'সয়াবিন তেল',
  unitCode: 'litre',
  stockMilli: 0,
  alertMilli: 3000,
  sellPricePaisa: 14000,
  buyPricePaisa: 12000,
  stockValuePaisa: 0,
  isService: false,
  lastMovementAt: null,
};

const rice = {
  ...oil,
  id: '00000000-0000-0000-0000-000000000002',
  name: 'মিনিকেট চাল',
  unitCode: 'kg',
  stockMilli: 4000,
  alertMilli: 5000,
  stockValuePaisa: 27200,
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/stock']}>
      <StockPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  role = 'owner';

  useStock.mockReturnValue({
    data: { pages: [[oil, rice]] },
    isPending: false,
    isError: false,
    isSuccess: true,
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
  });
  useStockOverview.mockReturnValue({
    data: { productCount: 2, lowCount: 1, outCount: 1, valuePaisa: 27200 },
    isPending: false,
  });
  recordAsync.mockResolvedValue({
    movementId: 'm-1',
    productId: rice.id,
    stockMilli: 3000,
    duplicate: false,
  });
});

describe('StockPage', () => {
  it('leads with the counts and the value of the shelf', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: bn.title })).toBeTruthy();
    expect(screen.getByText(bn.overview.products)).toBeTruthy();
    // 27200 paisa = ৳272
    expect(screen.getAllByText('৳২৭২').length).toBeGreaterThan(0);
  });

  it('marks the finished product and the one that is running out', () => {
    renderPage();

    expect(screen.getByText(bn.status.out)).toBeTruthy();
    expect(screen.getByText(bn.status.low)).toBeTruthy();
    expect(screen.getByText('সয়াবিন তেল')).toBeTruthy();
  });

  it('gives an owner a way to adjust a product', () => {
    renderPage();

    fireEvent.click(
      screen.getByRole('button', { name: bn.adjustFor.replace('{{name}}', 'মিনিকেট চাল') }),
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(bn.sheet.title)).toBeTruthy();
  });

  it('offers no adjustment to a cashier', () => {
    role = 'cashier';
    renderPage();

    expect(screen.queryByRole('button', { name: /স্টক ঠিক করুন/ })).toBeNull();
  });

  it('asks the database for the filtered list', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: bn.filter.low }));

    const lastCall = useStock.mock.calls[useStock.mock.calls.length - 1] as unknown[];
    expect(lastCall[2]).toBe('low');
  });

  it('shows skeletons instead of a blank screen while loading', () => {
    useStock.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      isSuccess: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    });

    renderPage();
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('explains a failure and offers a retry', () => {
    const refetch = vi.fn();
    useStock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isSuccess: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch,
    });

    renderPage();

    expect(screen.getByRole('alert').textContent).toContain(bn.loadFailed);
    fireEvent.click(screen.getByRole('button', { name: /আবার চেষ্টা করুন|Try again/ }));
    expect(refetch).toHaveBeenCalled();
  });
});
