/**
 * What each role may do, in one place.
 *
 * This mirrors the RLS policies in supabase/migrations/0008_rls.sql. The
 * database is the source of truth; this table exists so the UI can hide or
 * disable what the database would refuse anyway (a disabled button with an
 * explanation is kinder than an error after the fact).
 *
 * If you change a policy, change this file too — a unit test asserts the two
 * lists stay in sync.
 */

export const ROLES = ['owner', 'manager', 'cashier'] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = [
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
  'staff.manage',
  'audit.view',
  'export.data',
  'tenant.update',
] as const;

export type AppAction = (typeof ACTIONS)[number];

/** Roles allowed to perform each action. Order mirrors the SQL policies. */
const MATRIX: Record<AppAction, readonly Role[]> = {
  'sale.create': ['owner', 'manager', 'cashier'],
  'sale.void': ['owner', 'manager'],
  'sale.viewCost': ['owner', 'manager'],
  'reports.viewProfit': ['owner', 'manager'],
  'reports.view': ['owner', 'manager'],
  'product.create': ['owner', 'manager'],
  'product.update': ['owner', 'manager'],
  'product.delete': ['owner', 'manager'],
  'product.import': ['owner', 'manager'],
  'stock.move': ['owner', 'manager'],
  'stock.view': ['owner', 'manager', 'cashier'],
  'customer.create': ['owner', 'manager', 'cashier'],
  'customer.update': ['owner', 'manager', 'cashier'],
  'customer.delete': ['owner', 'manager'],
  'due.collect': ['owner', 'manager', 'cashier'],
  'settings.update': ['owner', 'manager'],
  'staff.manage': ['owner'],
  'audit.view': ['owner'],
  'export.data': ['owner'],
  'tenant.update': ['owner'],
};

export function can(role: Role | null | undefined, action: AppAction): boolean {
  if (!role) return false;
  return MATRIX[action].includes(role);
}

/** Convenience for the common "hide this section" case. */
export function canAny(role: Role | null | undefined, actions: readonly AppAction[]): boolean {
  return actions.some((action) => can(role, action));
}

/** Human list for a settings/support screen. */
export function rolesFor(action: AppAction): readonly Role[] {
  return MATRIX[action];
}
