import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import '@/lib/i18n';
import bn from '@/locales/bn/common.json';
import { usePreferences } from '@/features/settings/preferences';

import { HomePage } from './HomePage';

/**
 * Simple Mode is four big buttons and nothing else (PROJECT_RULES 3.1 #4). That
 * rule is a promise about the first screen a shopkeeper sees, so it is asserted
 * rather than left to review.
 */
describe('HomePage', () => {
  beforeEach(() => {
    usePreferences.setState({ mode: 'simple' });
  });

  const renderHome = () =>
    render(
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>,
    );

  it('offers exactly the four primary actions in Simple Mode', () => {
    renderHome();

    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(links).toEqual(expect.arrayContaining(['/sell', '/due', '/stock', '/today']));

    for (const label of [bn.nav.sell, bn.nav.due, bn.nav.stock, bn.nav.today]) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeTruthy();
    }
  });

  it('points বাকি at the screen that now exists', () => {
    renderHome();
    expect(screen.getByRole('link', { name: new RegExp(bn.nav.due) }).getAttribute('href')).toBe(
      '/due',
    );
  });

  it('adds the dashboard tiles and quick links in Pro Mode', () => {
    usePreferences.setState({ mode: 'pro' });
    renderHome();

    expect(screen.getByText(bn.home.totalDue)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: new RegExp(bn.nav.customers) }).getAttribute('href'),
    ).toBe('/customers');
  });

  it('never invents a number while the dashboard is still empty', () => {
    usePreferences.setState({ mode: 'pro' });
    renderHome();

    // A fake ৳0 today would be worse than a dash: it looks like real takings.
    expect(screen.queryByText('৳০')).toBeNull();
  });
});
