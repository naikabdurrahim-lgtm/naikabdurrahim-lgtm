import { createBrowserRouter } from 'react-router-dom';
import { BarChart3, Boxes, ShoppingCart, Users, Wallet } from 'lucide-react';
import { AppShell } from '@/app/layout/AppShell';
import { HomePage } from '@/app/pages/HomePage';
import { HealthPage } from '@/app/pages/HealthPage';
import { SettingsPage } from '@/app/pages/SettingsPage';
import { NotFoundPage } from '@/app/pages/NotFoundPage';
import { ModulePlaceholder } from '@/app/pages/ModulePlaceholder';
import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { RequireRole } from '@/features/auth/components/RequireRole';
import { RequireShop } from '@/features/auth/components/RequireShop';
import { SignInPage } from '@/features/auth/pages/SignInPage';
import { SignUpPage } from '@/features/auth/pages/SignUpPage';
import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import { ProductsPage } from '@/features/products/pages/ProductsPage';
import { ProductFormPage } from '@/features/products/pages/ProductFormPage';
import { CategoriesPage } from '@/features/products/pages/CategoriesPage';

/**
 * Route table.
 *
 * Public: sign in, sign up, health check, 404.
 * Signed in but no shop yet: onboarding only.
 * Signed in with a shop: the shell and its modules, with role guards on the
 * screens that show money or cost.
 */
export const router = createBrowserRouter([
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/sign-up', element: <SignUpPage /> },
  { path: '/health', element: <HealthPage /> },

  // Signed in, but may not have a shop yet.
  {
    element: <RequireAuth />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },

      // Everything below needs a shop.
      {
        element: <RequireShop />,
        children: [
          {
            path: '/',
            element: <AppShell />,
            children: [
              { index: true, element: <HomePage /> },
              { path: 'settings', element: <SettingsPage /> },
              {
                path: 'sell',
                element: <ModulePlaceholder icon={ShoppingCart} titleKey="nav.sell" phase={5} />,
              },
              {
                path: 'due',
                element: <ModulePlaceholder icon={Wallet} titleKey="nav.due" phase={6} />,
              },
              {
                path: 'stock',
                element: <ModulePlaceholder icon={Boxes} titleKey="nav.stock" phase={7} />,
              },
              {
                path: 'today',
                element: <ModulePlaceholder icon={BarChart3} titleKey="nav.today" phase={7} />,
              },
              {
                // The catalogue: owner, manager and cashier all need to look a
                // price up, so no role guard. Writes are gated by RLS anyway.
                path: 'products',
                children: [
                  { index: true, element: <ProductsPage /> },
                  { path: 'new', element: <ProductFormPage /> },
                  { path: 'categories', element: <CategoriesPage /> },
                  { path: ':productId', element: <ProductFormPage /> },
                ],
              },
              {
                path: 'customers',
                element: <ModulePlaceholder icon={Users} titleKey="nav.customers" phase={6} />,
              },
              {
                // Profit and cost data: owner and manager only.
                element: <RequireRole roles={['owner', 'manager']} />,
                children: [
                  {
                    path: 'reports',
                    element: (
                      <ModulePlaceholder icon={BarChart3} titleKey="nav.reports" phase={7} />
                    ),
                  },
                ],
              },
              // Unknown URL inside the shell: keep the bottom nav so the
              // shopkeeper is one tap from home.
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },

  // Unknown URL while signed out (or on a deep link that never existed):
  // the bare 404, no shell and no auth round-trip.
  { path: '*', element: <NotFoundPage /> },
]);
