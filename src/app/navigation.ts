import {
  BarChart3,
  BookOpen,
  Boxes,
  Home,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { can, type AppAction, type Role } from '@/lib/permissions';

export type NavItem = {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  /** Simple mode shows only these four actions on the home screen. */
  simplePrimary?: boolean;
  /** Hidden in Simple mode's bottom bar to respect the 5-slot limit. */
  hideInSimple?: boolean;
  /**
   * Action the screen needs. The nav hides it when the role cannot perform it,
   * so a cashier never taps into a screen the database would refuse.
   */
  action?: AppAction;
};

/**
 * Single navigation definition for both the desktop sidebar and the mobile
 * bottom bar. Order matters: the most-used actions come first (one-handed use).
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: Home },
  {
    to: '/sell',
    labelKey: 'nav.sell',
    icon: ShoppingCart,
    simplePrimary: true,
    action: 'sale.create',
  },
  { to: '/due', labelKey: 'nav.due', icon: Wallet, simplePrimary: true, action: 'due.collect' },
  { to: '/stock', labelKey: 'nav.stock', icon: Boxes, simplePrimary: true, action: 'stock.view' },
  { to: '/today', labelKey: 'nav.today', icon: BarChart3, simplePrimary: true },
  {
    to: '/products',
    labelKey: 'nav.products',
    icon: BookOpen,
    hideInSimple: true,
    action: 'product.update',
  },
  {
    to: '/customers',
    labelKey: 'nav.customers',
    icon: Users,
    hideInSimple: true,
    action: 'customer.create',
  },
  {
    to: '/reports',
    labelKey: 'nav.reports',
    icon: BarChart3,
    hideInSimple: true,
    action: 'reports.view',
  },
  // Settings is personal too (language, theme, numerals), so it stays for staff.
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
];

/**
 * The nav for one user: what their role may open, and what their mode wants to
 * show. An item with no `action` is safe for everybody.
 */
export function visibleNavItems(mode: 'simple' | 'pro', role: Role | null): NavItem[] {
  const allowed = NAV_ITEMS.filter((item) => !item.action || can(role, item.action));
  if (mode === 'pro') return allowed;
  // Simple mode keeps five slots max: home + four primary actions.
  return allowed
    .filter((item) => item.to === '/' || item.simplePrimary || item.to === '/settings')
    .slice(0, 5);
}
