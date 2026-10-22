import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, visibleNavItems } from './navigation';

describe('navigation', () => {
  it('simple mode shows at most five items, starting with home', () => {
    const items = visibleNavItems('simple', 'owner');
    expect(items.length).toBeLessThanOrEqual(5);
    expect(items[0]?.to).toBe('/');
  });

  it('simple mode includes the four primary actions', () => {
    const targets = visibleNavItems('simple', 'owner').map((item) => item.to);
    for (const path of ['/sell', '/due', '/stock', '/today']) {
      expect(targets).toContain(path);
    }
  });

  it('simple mode hides pro-only modules', () => {
    const targets = visibleNavItems('simple', 'owner').map((item) => item.to);
    expect(targets).not.toContain('/products');
    expect(targets).not.toContain('/reports');
  });

  it('pro mode exposes every item exactly once for the owner', () => {
    const items = visibleNavItems('pro', 'owner');
    expect(items).toHaveLength(NAV_ITEMS.length);
    expect(new Set(items.map((item) => item.to)).size).toBe(items.length);
  });

  it('never shows a cashier a screen the database would refuse', () => {
    const targets = visibleNavItems('pro', 'cashier').map((item) => item.to);
    expect(targets).not.toContain('/reports');
    expect(targets).not.toContain('/products');
    // The counter still works: sell, due, stock, customers, settings.
    for (const path of ['/sell', '/due', '/stock', '/customers', '/settings']) {
      expect(targets).toContain(path);
    }
  });

  it('gives a manager the product list but not the staff-only screens', () => {
    const targets = visibleNavItems('pro', 'manager').map((item) => item.to);
    expect(targets).toContain('/products');
    expect(targets).toContain('/reports');
  });

  it('shows only the safe items before a role is known', () => {
    const targets = visibleNavItems('pro', null).map((item) => item.to);
    expect(targets).toEqual(['/', '/today', '/settings']);
  });

  it('keeps settings available to every role', () => {
    for (const role of ['owner', 'manager', 'cashier'] as const) {
      expect(visibleNavItems('pro', role).map((item) => item.to)).toContain('/settings');
    }
  });
});
