import { Navigate, Outlet } from 'react-router-dom';
import type { Role } from '@/lib/permissions';
import { useAuth } from '@/features/auth/useAuth';

type RequireRoleProps = {
  roles: readonly Role[];
  /** Where to go instead of showing a dead end. */
  redirectTo?: string;
};

/**
 * UI-level role guard. The database enforces the same rules; this only prevents
 * a cashier from opening a page that would refuse them anyway.
 */
export function RequireRole({ roles, redirectTo = '/' }: RequireRoleProps) {
  const { role } = useAuth();
  if (!role || !roles.includes(role)) return <Navigate to={redirectTo} replace />;
  return <Outlet />;
}
