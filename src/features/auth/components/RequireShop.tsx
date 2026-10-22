import { Navigate, Outlet } from 'react-router-dom';
import { RotateCw } from 'lucide-react';
import { FullPageLoader } from '@/components/common/FullPageLoader';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

/**
 * Every screen below this guard needs a tenant, so the membership list must be
 * known before rendering. Three distinct outcomes:
 *
 *   loading  → skeleton (never a blank screen, never a flash of onboarding)
 *   error    → retry panel. Falling through to onboarding here would invite a
 *              shop owner to create a SECOND shop after a network blip.
 *   no shop  → onboarding.
 */
export function RequireShop() {
  const { initialising, hasShop, membershipsState, refresh } = useAuth();
  const { t } = useAppTranslation();

  if (initialising || membershipsState === 'loading') return <FullPageLoader />;

  if (membershipsState === 'error') {
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-5" role="alert">
        <div className="app-card w-full max-w-md space-y-4 p-6 text-center">
          <h1 className="text-lg font-semibold">{t('errors.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('errors.membershipsFailed')}</p>
          <Button type="button" size="lg" className="w-full" onClick={() => void refresh()}>
            <RotateCw aria-hidden="true" />
            {t('actions.retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (!hasShop) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
