import { createContext } from 'react';
import type { Role } from '@/lib/permissions';
import type { SessionUser, TenantMembership } from './lib/authService';

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in';

export type AuthContextValue = {
  status: AuthStatus;
  user: SessionUser | null;
  memberships: TenantMembership[];
  /** The shop the user is currently working in. */
  activeTenant: TenantMembership | null;
  role: Role | null;
  /** True while the very first session check runs. */
  initialising: boolean;
  /** True when Supabase is not configured at all (setup screen). */
  notConfigured: boolean;
  hasShop: boolean;
  /**
   * Why `hasShop` may be false: the membership query is still running, it failed,
   * or it genuinely returned nothing. Without this, a network blip would send a
   * shop owner back into onboarding and let them create a second shop.
   */
  membershipsState: 'loading' | 'ready' | 'error';
  signIn: (phone: string, pin: string) => Promise<void>;
  signUp: (input: { phone: string; pin: string; fullName: string }) => Promise<{ userId: string }>;
  signOut: () => Promise<void>;
  switchTenant: (tenantId: string) => void;
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
