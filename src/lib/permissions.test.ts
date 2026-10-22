import { describe, expect, it } from 'vitest';

import { ACTIONS, can, canAny, ROLES, rolesFor, type AppAction, type Role } from './permissions';

/**
 * This test is the counterpart of the RLS policies: the UI must never offer an
 * action the database would refuse, and must never hide one it allows.
 * `docs/DECISIONS.md` #28 records the matrix; supabase/tests/40_rls.sql proves
 * the database side.
 */
describe('permission matrix', () => {
  const ownerAllowed: AppAction[] = [...ACTIONS];
  const managerAllowed: AppAction[] = [
    'sale.create',
    'sale.void',
    'sale.viewCost',
    'reports.viewProfit',
    'reports.view',
    'product.create',
    'product.update',
    'product.delete',
    'product.import',
    'stock.move',
    'stock.view',
    'customer.create',
    'customer.update',
    'customer.delete',
    'due.collect',
    'settings.update',
  ];
  const cashierAllowed: AppAction[] = [
    'sale.create',
    'stock.view',
    'customer.create',
    'customer.update',
    'due.collect',
  ];

  it.each(ROLES)('%s gets exactly the documented actions', (role) => {
    const expected =
      role === 'owner' ? ownerAllowed : role === 'manager' ? managerAllowed : cashierAllowed;
    const actual = ACTIONS.filter((action) => can(role, action));
    expect(actual).toEqual(expected);
  });

  it('lets every role sell — the shop must never be blocked at the counter', () => {
    for (const role of ROLES) expect(can(role, 'sale.create')).toBe(true);
  });

  it('keeps cost, profit and void away from the cashier', () => {
    for (const action of ['sale.viewCost', 'reports.viewProfit', 'sale.void'] as const) {
      expect(can('cashier', action)).toBe(false);
    }
  });

  it('gives staff management, audit and export to the owner only', () => {
    for (const action of ['staff.manage', 'audit.view', 'export.data', 'tenant.update'] as const) {
      expect(rolesFor(action)).toEqual(['owner']);
      expect(can('manager', action)).toBe(false);
      expect(can('owner', action)).toBe(true);
    }
  });

  it('treats a missing role as no permission at all', () => {
    for (const action of ACTIONS) {
      expect(can(null, action)).toBe(false);
      expect(can(undefined, action)).toBe(false);
    }
  });

  it('never grants an action to an unknown role string', () => {
    // A role coming from the server is untrusted input.
    expect(can('admin' as Role, 'staff.manage')).toBe(false);
  });

  it('always names at least one role per action', () => {
    for (const action of ACTIONS) expect(rolesFor(action).length).toBeGreaterThan(0);
  });

  it('lists no duplicate action', () => {
    expect(new Set(ACTIONS).size).toBe(ACTIONS.length);
  });
});

describe('canAny', () => {
  it('is true when any listed action is allowed', () => {
    expect(canAny('cashier', ['staff.manage', 'sale.create'])).toBe(true);
    expect(canAny('cashier', ['staff.manage', 'audit.view'])).toBe(false);
    expect(canAny('cashier', [])).toBe(false);
  });
});
