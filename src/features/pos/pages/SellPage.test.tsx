import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/lib/i18n';
import bn from '@/locales/bn/pos.json';
import type { Product } from '@/features/products/types';

import { SellPage } from './SellPage';

/**
 * The sell screen, exercised the way a shopkeeper uses it: tap a product, check
 * the total, open the payment sheet, confirm. Everything below the hooks is the
 * real implementation — the cart maths and the screens are what is being tested.
 */

const usePosProducts = vi.fn();
const usePosSettings = vi.fn();
const useCanDiscount = vi.fn();
const useSubmitSale = vi.fn();
const useVoidSale = vi.fn();

vi.mock('../queries', () => ({
  usePosProducts: (...args: unknown[]) => usePosProducts(...args),
  usePosSettings: (...args: unknown[]) => usePosSettings(...args),
  useCanDiscount: () => useCanDiscount(),
  useSubmitSale: () => useSubmitSale(),
  useVoidSale: () => useVoidSale(),
}));

vi.mock('@/features/customers/queries', () => ({
  useCustomerSearch: () => ({ data: [], isPending: false, isSuccess: true }),
  useCreateCustomer: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ activeTenant: { tenantId: 'tenant-1', role: 'owner' } }),
}));

const rice: Product = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'মিনিকেট চাল',
  nameEn: 'Miniket rice',
  categoryId: null,
  categoryName: null,
  unitCode: 'kg',
  barcode: '8901234567890',
  sku: null,
  sellPricePaisa: 7500,
  buyPricePaisa: 6800,
  wholesalePricePaisa: null,
  stockMilli: 20_000,
  stockAlertMilli: 0,
  isService: false,
  isActive: true,
  updatedAt: '2026-01-01T00:00:00Z',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/sell']}>
      <SellPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  usePosProducts.mockReturnValue({
    data: { pages: [[rice]] },
    isPending: false,
    isError: false,
  });
  usePosSettings.mockReturnValue({
    data: {
      receiptFooter: '',
      receiptHeader: null,
      allowCashierDiscount: true,
      allowNegativeStock: false,
    },
    isPending: false,
  });
  useCanDiscount.mockReturnValue(true);
  useSubmitSale.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  useVoidSale.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
});

describe('SellPage', () => {
  it('shows the bill is empty until a product is picked', () => {
    renderPage();
    expect(screen.getAllByText(bn.cartEmptyTitle).length).toBeGreaterThan(0);
  });

  it('adds a tapped product and totals it', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /মিনিকেট চাল/ }));

    // The line on the bill, and the amount 1 kg × ৳75.
    expect(screen.getAllByText('মিনিকেট চাল').length).toBeGreaterThan(1);
    expect(screen.getAllByLabelText('৳75').length).toBeGreaterThan(0);
  });

  it('names the quantity step for a weighed product', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /মিনিকেট চাল/ }));

    // 1 kg → the step-up button adds half a kilo, not a whole piece.
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${bn.qty} \\+`) }));
    expect(screen.getAllByText(/১\.৫|1\.5/).length).toBeGreaterThan(0);
  });

  it('opens the payment sheet with the total and a confirm button', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /মিনিকেট চাল/ }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(bn.confirmSale) }));

    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText(bn.total)).toBeInTheDocument();
    const confirm = within(sheet).getByRole('button', { name: new RegExp(bn.confirmSale) });
    // A cash sale with nothing typed is paid in full, so the button is usable.
    expect(confirm).toBeEnabled();
  });

  it('stops a credit sale that has nobody to owe the money', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /মিনিকেট চাল/ }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(bn.confirmSale) }));

    const sheet = screen.getByRole('dialog');
    fireEvent.click(within(sheet).getByRole('checkbox', { name: new RegExp(bn.credit) }));

    const confirm = within(sheet).getByRole('button', { name: new RegExp(bn.confirmSale) });
    expect(confirm).toBeDisabled();
    expect(within(sheet).getByText(bn.customerRequired)).toBeInTheDocument();
  });

  it('lets an owner override the price of a line', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /মিনিকেট চাল/ }));
    // Tapping the quantity opens the line sheet, which carries the price field.
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${bn.qty}:`) }));

    expect(screen.getByLabelText(new RegExp(bn.unitPrice))).toBeInTheDocument();
  });
});
