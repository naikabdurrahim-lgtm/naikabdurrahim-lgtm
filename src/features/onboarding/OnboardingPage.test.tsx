import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import bnOnboarding from '@/locales/bn/onboarding.json';
import '@/lib/i18n';

import { OnboardingError } from './api';
import { OnboardingPage } from './OnboardingPage';
import type * as OnboardingApi from './api';

const createShop = vi.fn();
const refresh = vi.fn();

vi.mock('@/features/onboarding/api', async () => {
  const actual = await vi.importActual<typeof OnboardingApi>('./api');
  return { ...actual, createShop: (...args: unknown[]) => createShop(...args) };
});

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ refresh, user: { fullName: 'আব্দুর রহিম' } }),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<p>হোম</p>} />
      </Routes>
    </MemoryRouter>,
  );

const next = () => screen.getByRole('button', { name: new RegExp(bnOnboarding.next) });

beforeEach(() => {
  vi.clearAllMocks();
  createShop.mockResolvedValue({ tenantId: 'tenant-1' });
  refresh.mockResolvedValue(undefined);
});

describe('OnboardingPage', () => {
  it('starts at step 1 and refuses to continue without a business type', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: bnOnboarding.businessType.title }),
    ).toBeInTheDocument();
    expect(next()).toBeDisabled();
  });

  it('offers all six business types, then moves to the shop name', () => {
    renderPage();
    const cards = screen.getAllByRole('radio');
    expect(cards).toHaveLength(6);

    fireEvent.click(cards[0] as HTMLElement);
    expect(next()).toBeEnabled();
    fireEvent.click(next());

    expect(screen.getByRole('heading', { name: bnOnboarding.shopName.title })).toBeInTheDocument();
    expect(next()).toBeDisabled();
  });

  it('writes nothing until the last button', async () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('radio')[0] as HTMLElement);
    fireEvent.click(next());

    fireEvent.change(screen.getByLabelText(bnOnboarding.shopName.title), {
      target: { value: 'রহিম স্টোর' },
    });
    fireEvent.click(next()); // step 3
    fireEvent.click(next()); // step 4

    expect(createShop).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(bnOnboarding.create) }));

    await waitFor(() => expect(createShop).toHaveBeenCalledTimes(1));
    const [input] = createShop.mock.calls[0] as [
      { name: string; pack: { id: string }; sampleProducts: unknown[] },
    ];
    expect(input.name).toBe('রহিম স্টোর');
    expect(input.pack.id).toBe('grocery');
    // Every starter product is preselected, so the shop opens with a catalogue.
    expect(input.sampleProducts.length).toBeGreaterThan(0);
  });

  it('lets the owner clear the starter list and still create the shop', async () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('radio')[0] as HTMLElement);
    fireEvent.click(next());
    fireEvent.change(screen.getByLabelText(bnOnboarding.shopName.title), {
      target: { value: 'রহিম স্টোর' },
    });
    fireEvent.click(next());

    fireEvent.click(screen.getByRole('button', { name: bnOnboarding.sampleProducts.clearAll }));
    expect(screen.getByText(bnOnboarding.sampleProducts.skip)).toBeInTheDocument();
    fireEvent.click(next());
    fireEvent.click(screen.getByRole('button', { name: new RegExp(bnOnboarding.create) }));

    await waitFor(() => expect(createShop).toHaveBeenCalled());
    const [input] = createShop.mock.calls[0] as [{ sampleProducts: unknown[] }];
    expect(input.sampleProducts).toEqual([]);
  });

  it('goes back without losing what was typed', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('radio')[1] as HTMLElement);
    fireEvent.click(next());
    fireEvent.change(screen.getByLabelText(bnOnboarding.shopName.title), {
      target: { value: 'রহিম স্টোর' },
    });

    fireEvent.click(screen.getByRole('button', { name: new RegExp(bnOnboarding.back) }));
    expect(screen.getAllByRole('radio')[1]).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(next());
    expect(screen.getByLabelText(bnOnboarding.shopName.title)).toHaveValue('রহিম স্টোর');
  });

  it('shows a Bangla message when the shop cannot be created', async () => {
    createShop.mockRejectedValue(new OnboardingError('create_failed'));

    renderPage();
    fireEvent.click(screen.getAllByRole('radio')[0] as HTMLElement);
    fireEvent.click(next());
    fireEvent.change(screen.getByLabelText(bnOnboarding.shopName.title), {
      target: { value: 'রহিম স্টোর' },
    });
    fireEvent.click(next());
    fireEvent.click(next());
    fireEvent.click(screen.getByRole('button', { name: new RegExp(bnOnboarding.create) }));

    expect(await screen.findByRole('alert')).toHaveTextContent(bnOnboarding.errors.create_failed);
    // The form is still usable, so a retry is possible.
    expect(screen.getByRole('button', { name: new RegExp(bnOnboarding.create) })).toBeEnabled();
  });

  it('moves on instead of duplicating the shop when only the products failed', async () => {
    createShop.mockRejectedValue(new OnboardingError('products_failed'));

    renderPage();
    fireEvent.click(screen.getAllByRole('radio')[0] as HTMLElement);
    fireEvent.click(next());
    fireEvent.change(screen.getByLabelText(bnOnboarding.shopName.title), {
      target: { value: 'রহিম স্টোর' },
    });
    fireEvent.click(next());
    fireEvent.click(next());
    fireEvent.click(screen.getByRole('button', { name: new RegExp(bnOnboarding.create) }));

    // Landed on the home route, and memberships were re-read.
    expect(await screen.findByText('হোম')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
    expect(createShop).toHaveBeenCalledTimes(1);
  });
});
