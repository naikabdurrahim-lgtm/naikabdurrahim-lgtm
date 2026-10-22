import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { appConfig } from '@/lib/env';
import type { Role } from '@/lib/permissions';
import { AuthContext, type AuthStatus } from './AuthContext';
import {
  getCurrentUser,
  listMemberships,
  signInWithPin,
  signOut as signOutService,
  signUpWithPin,
  type SessionUser,
  type TenantMembership,
} from './lib/authService';

const ACTIVE_TENANT_KEY = 'dokan-bondhu.activeTenant.v1';

/**
 * Owns the session and the set of shops the user belongs to.
 *
 * Session tokens are handled entirely by supabase-js (PKCE flow, auto refresh);
 * we never read or store the token ourselves. On Android, Phase 12 swaps the
 * storage adapter for Capacitor secure storage.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [initialising, setInitialising] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [membershipsState, setMembershipsState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [activeTenantId, setActiveTenantId] = useState<string | null>(() => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(ACTIVE_TENANT_KEY);
  });

  const notConfigured = !appConfig.supabaseConfigured;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadMemberships = useCallback(async (userId: string): Promise<void> => {
    try {
      const list = await listMemberships(userId);
      if (!mounted.current) return;
      setMemberships(list);
      setMembershipsState('ready');
    } catch (error) {
      console.error('[auth] membership load failed', error);
      if (!mounted.current) return;
      setMemberships([]);
      setMembershipsState('error');
    }
  }, []);

  const hydrate = useCallback(
    async (options: { showInitialising?: boolean } = {}) => {
      if (notConfigured) {
        setMembershipsState('ready');
        setStatus('signed_out');
        setInitialising(false);
        return;
      }

      const current = await getCurrentUser();
      if (!mounted.current) return;

      if (!current) {
        setUser(null);
        setMemberships([]);
        setMembershipsState('ready');
        setStatus('signed_out');
        setInitialising(false);
        return;
      }

      setUser(current);
      if (options.showInitialising ?? false) setMembershipsState('loading');
      await loadMemberships(current.id);
      setStatus('signed_in');
      setInitialising(options.showInitialising ?? false);
    },
    [loadMemberships, notConfigured],
  );

  // First load + reaction to sign-in / sign-out / token refresh.
  useEffect(() => {
    void hydrate({ showInitialising: true });

    const sb = getSupabase();
    if (!sb) return;

    const { data } = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setMemberships([]);
        setMembershipsState('ready');
        setStatus('signed_out');
        setInitialising(false);
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void hydrate();
      }
    });

    return () => data.subscription.unsubscribe();
  }, [hydrate]);

  // Keep the chosen shop valid: fall back to the first membership.
  useEffect(() => {
    if (memberships.length === 0) return;
    const stillValid = memberships.some((m) => m.tenantId === activeTenantId);
    if (!stillValid) {
      const first = memberships[0];
      if (first) setActiveTenantId(first.tenantId);
    }
  }, [memberships, activeTenantId]);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    if (activeTenantId) localStorage.setItem(ACTIVE_TENANT_KEY, activeTenantId);
    else localStorage.removeItem(ACTIVE_TENANT_KEY);
  }, [activeTenantId]);

  const signIn = useCallback(
    async (phone: string, pin: string) => {
      await signInWithPin(phone, pin);
      await hydrate();
    },
    [hydrate],
  );

  const signUp = useCallback(
    async (input: { phone: string; pin: string; fullName: string }) => {
      const result = await signUpWithPin(input);
      await hydrate();
      return result;
    },
    [hydrate],
  );

  const signOut = useCallback(async () => {
    await signOutService();
    setUser(null);
    setMemberships([]);
    setActiveTenantId(null);
    setStatus('signed_out');
  }, []);

  const switchTenant = useCallback((tenantId: string) => {
    setActiveTenantId(tenantId);
  }, []);

  const refresh = useCallback(async () => {
    await hydrate();
  }, [hydrate]);

  const activeTenant = useMemo(
    () => memberships.find((m) => m.tenantId === activeTenantId) ?? memberships[0] ?? null,
    [memberships, activeTenantId],
  );

  const value = useMemo(
    () => ({
      status,
      user,
      memberships,
      activeTenant,
      role: (activeTenant?.role ?? null) as Role | null,
      initialising,
      notConfigured,
      hasShop: memberships.length > 0,
      membershipsState,
      signIn,
      signUp,
      signOut,
      switchTenant,
      refresh,
    }),
    [
      status,
      user,
      memberships,
      activeTenant,
      membershipsState,
      initialising,
      notConfigured,
      signIn,
      signUp,
      signOut,
      switchTenant,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
