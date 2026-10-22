import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FullPageLoader } from '@/components/common/FullPageLoader';
import { SetupNotice } from '@/components/common/SetupNotice';
import { useAuth } from '@/features/auth/useAuth';

/**
 * Route guard: a signed-out visitor is sent to sign-in and comes back to where
 * they were going afterwards.
 *
 * While the first session check runs we show a skeleton, never a blank screen or
 * a flash of the sign-in form (PROJECT_RULES 3.1 #14).
 */
export function RequireAuth() {
  const { status, initialising, notConfigured } = useAuth();
  const location = useLocation();

  if (notConfigured) return <SetupNotice />;
  if (initialising || status === 'loading') return <FullPageLoader />;
  if (status === 'signed_out') {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
