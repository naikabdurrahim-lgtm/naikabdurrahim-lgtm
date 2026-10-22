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

export type NavItem = {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  /** Simple mode shows only these four actions on the home screen. */
  simplePrimary?: boolean;
  /** Hidden in Simple mode's bottom bar to respect the 5-slot limit. */
  hideInSimple?: boolean;
};

/**
 * Single navigation definition for both the desktop sidebar and the mobile
 * bottom bar. Order matters: the most-used actions come first (one-handed use).
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: Home },
  { to: '/sell', labelKey: 'nav.sell', icon: ShoppingCart, simplePrimary: true },
  { to: '/due', labelKey: 'nav.due', icon: Wallet, simplePrimary: true },
  { to: '/stock', labelKey: 'nav.stock', icon: Boxes, simplePrimary: true },
  { to: '/today', labelKey: 'nav.today', icon: BarChart3, simplePrimary: true },
  { to: '/products', labelKey: 'nav.products', icon: BookOpen, hideInSimple: true },
  { to: '/customers', labelKey: 'nav.customers', icon: Users, hideInSimple: true },
  { to: '/reports', labelKey: 'nav.reports', icon: BarChart3, hideInSimple: true },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
];

export function visibleNavItems(mode: 'simple' | 'pro'): NavItem[] {
  if (mode === 'pro') return NAV_ITEMS;
  // Simple mode keeps five slots max: home + four primary actions.
  return NAV_ITEMS.filter(
    (item) => item.to === '/' || item.simplePrimary || item.to === '/settings',
  ).slice(0, 5);
}
