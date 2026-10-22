import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/app/layout/AppShell';
import { HomePage } from '@/app/pages/HomePage';
import { HealthPage } from '@/app/pages/HealthPage';
import { SettingsPage } from '@/app/pages/SettingsPage';
import { NotFoundPage } from '@/app/pages/NotFoundPage';
import { ModulePlaceholder } from '@/app/pages/ModulePlaceholder';
import { Boxes, BookOpen, BarChart3, ShoppingCart, Users, Wallet } from 'lucide-react';

/**
 * Route table. Modules scheduled for later phases are real routes now so the
 * navigation, guards (Phase 3) and deep links can be tested from day one.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'health', element: <HealthPage /> },
      { path: 'settings', element: <SettingsPage /> },
      {
        path: 'sell',
        element: <ModulePlaceholder icon={ShoppingCart} titleKey="nav.sell" phase={5} />,
      },
      { path: 'due', element: <ModulePlaceholder icon={Wallet} titleKey="nav.due" phase={6} /> },
      { path: 'stock', element: <ModulePlaceholder icon={Boxes} titleKey="nav.stock" phase={7} /> },
      {
        path: 'today',
        element: <ModulePlaceholder icon={BarChart3} titleKey="nav.today" phase={7} />,
      },
      {
        path: 'products',
        element: <ModulePlaceholder icon={BookOpen} titleKey="nav.products" phase={4} />,
      },
      {
        path: 'customers',
        element: <ModulePlaceholder icon={Users} titleKey="nav.customers" phase={6} />,
      },
      {
        path: 'reports',
        element: <ModulePlaceholder icon={BarChart3} titleKey="nav.reports" phase={7} />,
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
