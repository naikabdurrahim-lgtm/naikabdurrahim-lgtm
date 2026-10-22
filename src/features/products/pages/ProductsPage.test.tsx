import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n, { i18nReady } from '@/lib/i18n';
import bn from '@/locales/bn/products.json';
import type { Category, Product } from '../types';

import { ProductsPage } from './ProductsPage';

/**
 * The catalogue screen is where a shopkeeper finds a price mid-sale, so the
 * three list states (loading, empty, rows) and the "running out" filter are
 * pinned here. Everything is mocked at the hook boundary: this tests the screen,
 * not Postgres — the RPC has its own SQL suite in `supabase/tests/60_catalog.sql`.
 */

const useProducts = vi.fn();
const useCategories = vi.fn();

vi.mock('../queries', () => ({
  useProducts: (...args: unknown[]) => useProducts(...args),
  useCategories: (...args: unknown[]) => useCategories(...args),
}));

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ activeTenant: { tenantId: 'tenant-1' } }),
}));

const product: Product = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'মিনিকেট চাল',
  nameEn: 'Miniket rice',
  categoryId: null,
  categoryName: 'চাল-ডাল',
  unitCode: 'kg',
  barcode: null,
  sku: null,
  sellPricePaisa: 7500,
  buyPricePaisa: 6800,
  wholesalePricePaisa: null,
  stockMilli: 0,
  stockAlertMilli: 0,
  isService: false,
  isActive: true,
  updatedAt: '2026-01-01T00:00:00Z',
};

const categories: Category[] = [
  {
    id: '00000000-0000-0000-0000-0000000000aa',
    name: 'চাল-ডাল',
    nameEn: null,
    icon: 'wheat',
    sortOrder: 0,
    isActive: true,
    productCount: 2,
  },
];

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/products']}>
      <ProductsPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  useCategories.mockReturnValue({ data: categories, isPending: false, isError: false });
  useProducts.mockReturnValue({
    data: { pages: [[product]] },
    isPending: false,
    isError: false,
    isSuccess: true,
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
  });
});

describe('ProductsPage', () => {
  it('lists the catalogue with prices and stock state', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(bn.title);
    expect(screen.getByText('মিনিকেট চাল')).toBeInTheDocument();
    // Out of stock, not merely low: no alert level is configured.
    expect(screen.getByText(bn.outOfStock)).toBeInTheDocument();
  });

  it('shows a skeleton, never a blank screen, while loading', () => {
    useProducts.mockReturnValue({ isPending: true, isError: false, isSuccess: false });
    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('offers a retry instead of a raw error when the list fails', () => {
    const refetch = vi.fn();
    useProducts.mockReturnValue({ isPending: false, isError: true, isSuccess: false, refetch });
    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(bn.loadFailed);
    fireEvent.click(screen.getByRole('button', { name: bn.retry }));
    expect(refetch).toHaveBeenCalled();
  });

  it('invites the shopkeeper to add the first product when empty', async () => {
    useProducts.mockReturnValue({
      data: { pages: [[]] },
      isPending: false,
      isError: false,
      isSuccess: true,
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    });
    renderPage();

    // The empty-state sentence is interpolated ("no <product> yet"), so it is
    // built the same way the screen builds it.
    await i18nReady;
    expect(
      screen.getByText(i18n.t('products:emptyTitle', { product: bn.product })),
    ).toBeInTheDocument();
    // Two ways in: the button in the header and the one in the empty state.
    expect(screen.getAllByRole('button', { name: new RegExp(bn.addShort) })).toHaveLength(2);
  });

  it('asks the server for low-stock rows when the chip is pressed', () => {
    renderPage();

    const chip = screen.getByRole('button', { name: bn.lowStockOnly });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);

    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(useProducts).toHaveBeenLastCalledWith(
      'tenant-1',
      expect.objectContaining({ lowStock: true }),
    );
  });

  it('passes the search text to the server, debounced', async () => {
    renderPage();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'চাল' } });

    await vi.waitFor(() =>
      expect(useProducts).toHaveBeenLastCalledWith(
        'tenant-1',
        expect.objectContaining({ query: 'চাল' }),
      ),
    );
  });
});
