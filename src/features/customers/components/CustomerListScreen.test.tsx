import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/lib/i18n';
import bn from '@/locales/bn/customers.json';

import { CustomerListScreen } from './CustomerListScreen';

/**
 * The বাকি screen end to end, with the network replaced by a mock.
 *
 * What is being tested is the tap path a shopkeeper actually walks: the total on
 * top, the debtor's row, "আদায়", the pre-filled amount, "টাকা পেয়েছি", and the
 * ten-second undo that reverses it.
 */

const useCustomers = vi.fn();
const useDueSummary = vi.fn();
const useCollectPayment = vi.fn();
const useVoidPayment = vi.fn();

const collectAsync = vi.fn();
const voidAsync = vi.fn();

vi.mock('../queries', () => ({
  useCustomers: (...args: unknown[]) => useCustomers(...args),
  useDueSummary: (...args: unknown[]) => useDueSummary(...args),
  useCollectPayment: () => useCollectPayment(),
  useVoidPayment: () => useVoidPayment(),
}));

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ activeTenant: { tenantId: 'tenant-1', role: 'cashier' } }),
}));

const rahim = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'রহিম ভাই',
  phone: '+8801712345678',
  duePaisa: 6000,
  creditLimitPaisa: null,
  lastActivityAt: null,
  createdAt: '2026-01-01T04:00:00Z',
};

const salma = {
  ...rahim,
  id: '00000000-0000-0000-0000-000000000002',
  name: 'সালমা বেগম',
  phone: null,
  duePaisa: 0,
};

const renderScreen = (mode: 'due' | 'all' = 'due') =>
  render(
    <MemoryRouter initialEntries={['/due']}>
      <CustomerListScreen mode={mode} />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();

  useCustomers.mockReturnValue({
    data: { pages: [[rahim, salma]] },
    isPending: false,
    isError: false,
    isSuccess: true,
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
  });

  useDueSummary.mockReturnValue({
    data: { totalDuePaisa: 6000, debtorCount: 1, customerCount: 2, oldestDueAt: null },
    isPending: false,
  });

  collectAsync.mockResolvedValue({
    paymentId: '00000000-0000-0000-0000-0000000000aa',
    amountPaisa: 6000,
    balancePaisa: 0,
    duplicate: false,
  });
  voidAsync.mockResolvedValue({ alreadyVoided: false, balancePaisa: 6000 });

  useCollectPayment.mockReturnValue({ mutateAsync: collectAsync, isPending: false });
  useVoidPayment.mockReturnValue({ mutateAsync: voidAsync, isPending: false });
});

describe('the বাকি screen', () => {
  it('leads with the shop total and lists the debtors', () => {
    renderScreen();

    expect(screen.getByRole('heading', { level: 1, name: bn.due.title })).toBeTruthy();
    // 6000 paisa = ৳60, in Bangla numerals by default.
    expect(screen.getAllByText('৳৬০').length).toBeGreaterThan(0);
    expect(screen.getByText('রহিম ভাই')).toBeTruthy();
    expect(screen.getByText('সালমা বেগম')).toBeTruthy();
  });

  it('offers a collect button only on rows that owe money', () => {
    renderScreen();

    const collectButtons = screen.getAllByRole('button', { name: new RegExp(bn.collect.short) });
    expect(collectButtons).toHaveLength(1);
  });

  it('pre-fills the whole due, then collects and offers an undo', async () => {
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(bn.collect.short) }));

    // The sheet opens with the full amount already typed.
    const amount = (await screen.findByLabelText(bn.collect.amount)) as HTMLInputElement;
    expect(amount.value).toBe('60');

    fireEvent.click(screen.getByRole('button', { name: new RegExp(bn.collect.confirm) }));

    await waitFor(() =>
      expect(collectAsync).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: rahim.id, amountPaisa: 6000, method: 'cash' }),
      ),
    );

    // The undo window is now on screen; ten seconds later it disappears.
    expect(await screen.findByText(new RegExp(bn.undo.collected))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ফেরান|Undo/ }));

    await waitFor(() =>
      expect(voidAsync).toHaveBeenCalledWith('00000000-0000-0000-0000-0000000000aa'),
    );
  });

  it('never fills the amount by itself when the due is zero', () => {
    useCustomers.mockReturnValue({
      data: { pages: [[salma]] },
      isPending: false,
      isError: false,
      isSuccess: true,
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    });

    renderScreen();

    // A row that owes nothing gets no collect button, so a zero collection is
    // not reachable from this screen.
    expect(screen.queryByRole('button', { name: new RegExp(bn.collect.short) })).toBeNull();
    expect(screen.getByText(bn.settled)).toBeTruthy();
  });

  it('shows the friendly empty state when nobody owes anything', () => {
    useCustomers.mockReturnValue({
      data: { pages: [[]] },
      isPending: false,
      isError: false,
      isSuccess: true,
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    });
    useDueSummary.mockReturnValue({
      data: { totalDuePaisa: 0, debtorCount: 0, customerCount: 0, oldestDueAt: null },
      isPending: false,
    });

    renderScreen();
    expect(screen.getByText(bn.due.emptyTitle)).toBeTruthy();
  });

  it('shows skeletons, not a blank page, while loading', () => {
    useCustomers.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      isSuccess: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    });

    renderScreen();
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('explains a failure and offers a retry', () => {
    const refetch = vi.fn();
    useCustomers.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isSuccess: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch,
    });

    renderScreen();
    expect(screen.getByRole('alert').textContent).toContain(bn.loadFailed);
    fireEvent.click(screen.getByRole('button', { name: /আবার চেষ্টা করুন|Try again/ }));
    expect(refetch).toHaveBeenCalled();
  });
});
