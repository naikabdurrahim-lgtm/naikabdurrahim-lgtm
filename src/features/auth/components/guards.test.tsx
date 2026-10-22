import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/lib/i18n';
import type { AuthContextValue } from '@/features/auth/AuthContext';

import { RequireAuth } from './RequireAuth';
import { RequireRole } from './RequireRole';
import { RequireShop } from './RequireShop';

const auth = vi.hoisted(() => ({ current: {} as Partial<AuthContextValue> }));

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => auth.current,
}));

const renderAt = (path: string, element: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {element}
        <Route path="/sign-in" element={<p>সাইন ইন</p>} />
        <Route path="/onboarding" element={<p>দোকান চালু</p>} />
        <Route path="/" element={<p>হোম</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  auth.current = {
    status: 'signed_in',
    initialising: false,
    notConfigured: false,
    hasShop: true,
    membershipsState: 'ready',
    role: 'owner',
  };
});

describe('RequireAuth', () => {
  it('shows a loader during the first session check, never a blank screen', () => {
    auth.current = { ...auth.current, initialising: true, status: 'loading' };
    renderAt(
      '/sell',
      <Route element={<RequireAuth />}>
        <Route path="/sell" element={<p>বিক্রি</p>} />
      </Route>,
    );
    expect(screen.queryByText('বিক্রি')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('sends a signed-out visitor to sign-in', () => {
    auth.current = { ...auth.current, status: 'signed_out' };
    renderAt(
      '/sell',
      <Route element={<RequireAuth />}>
        <Route path="/sell" element={<p>বিক্রি</p>} />
      </Route>,
    );
    expect(screen.getByText('সাইন ইন')).toBeInTheDocument();
  });

  it('lets a signed-in user through', () => {
    renderAt(
      '/sell',
      <Route element={<RequireAuth />}>
        <Route path="/sell" element={<p>বিক্রি</p>} />
      </Route>,
    );
    expect(screen.getByText('বিক্রি')).toBeInTheDocument();
  });

  it('explains the missing configuration instead of looping to sign-in', () => {
    auth.current = { ...auth.current, notConfigured: true, status: 'signed_out' };
    renderAt(
      '/sell',
      <Route element={<RequireAuth />}>
        <Route path="/sell" element={<p>বিক্রি</p>} />
      </Route>,
    );
    expect(screen.queryByText('সাইন ইন')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /শুরু করার আগে/ })).toBeInTheDocument();
  });
});

describe('RequireShop', () => {
  it('sends a signed-in user without a shop to onboarding', () => {
    auth.current = { ...auth.current, hasShop: false };
    renderAt(
      '/sell',
      <Route element={<RequireShop />}>
        <Route path="/sell" element={<p>বিক্রি</p>} />
      </Route>,
    );
    expect(screen.getByText('দোকান চালু')).toBeInTheDocument();
  });

  it('waits while memberships load', () => {
    auth.current = {
      ...auth.current,
      initialising: false,
      membershipsState: 'loading',
      hasShop: false,
    };
    renderAt(
      '/sell',
      <Route element={<RequireShop />}>
        <Route path="/sell" element={<p>বিক্রি</p>} />
      </Route>,
    );
    expect(screen.queryByText('দোকান চালু')).not.toBeInTheDocument();
  });

  it('offers a retry instead of a second onboarding when loading failed', () => {
    auth.current = { ...auth.current, membershipsState: 'error', hasShop: false };
    renderAt(
      '/sell',
      <Route element={<RequireShop />}>
        <Route path="/sell" element={<p>বিক্রি</p>} />
      </Route>,
    );

    // Crucial: the owner is NOT pushed into creating a duplicate shop.
    expect(screen.queryByText('দোকান চালু')).not.toBeInTheDocument();
    expect(screen.queryByText('বিক্রি')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/দোকানের তথ্য/);
    expect(screen.getByRole('button', { name: /আবার চেষ্টা করুন/ })).toBeInTheDocument();
  });

  it('lets a user with a shop through', () => {
    renderAt(
      '/sell',
      <Route element={<RequireShop />}>
        <Route path="/sell" element={<p>বিক্রি</p>} />
      </Route>,
    );
    expect(screen.getByText('বিক্রি')).toBeInTheDocument();
  });
});

describe('RequireRole', () => {
  const routes = (
    <Route element={<RequireRole roles={['owner', 'manager']} />}>
      <Route path="/reports" element={<p>রিপোর্ট</p>} />
    </Route>
  );

  it('lets an allowed role in', () => {
    auth.current = { ...auth.current, role: 'manager' };
    renderAt('/reports', routes);
    expect(screen.getByText('রিপোর্ট')).toBeInTheDocument();
  });

  it('sends a cashier home instead of showing a dead end', () => {
    auth.current = { ...auth.current, role: 'cashier' };
    renderAt('/reports', routes);
    expect(screen.queryByText('রিপোর্ট')).not.toBeInTheDocument();
    expect(screen.getByText('হোম')).toBeInTheDocument();
  });

  it('treats an unknown role as no access', () => {
    auth.current = { ...auth.current, role: null };
    renderAt('/reports', routes);
    expect(screen.queryByText('রিপোর্ট')).not.toBeInTheDocument();
  });
});
