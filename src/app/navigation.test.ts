import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, visibleNavItems } from './navigation';

describe('navigation', () => {
  it('simple mode shows at most five items, starting with home', () => {
    const items = visibleNavItems('simple');
    expect(items.length).toBeLessThanOrEqual(5);
    expect(items[0]?.to).toBe('/');
  });

  it('simple mode includes the four primary actions', () => {
    const targets = visibleNavItems('simple').map((item) => item.to);
    for (const path of ['/sell', '/due', '/stock', '/today']) {
      expect(targets).toContain(path);
    }
  });

  it('simple mode hides pro-only modules', () => {
    const targets = visibleNavItems('simple').map((item) => item.to);
    expect(targets).not.toContain('/products');
    expect(targets).not.toContain('/reports');
  });

  it('pro mode exposes every item exactly once', () => {
    const items = visibleNavItems('pro');
    expect(items).toHaveLength(NAV_ITEMS.length);
    expect(new Set(items.map((item) => item.to)).size).toBe(items.length);
  });
});
