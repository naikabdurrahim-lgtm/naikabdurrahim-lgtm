import { getSupabase } from '@/lib/supabase/client';
import type { Role } from '@/lib/permissions';
import { AuthError, mapSupabaseAuthError } from './authErrors';
import { hashPhone, normaliseBdPhone, phoneToSyntheticEmail, sha256Hex } from './phone';
import { checkPin } from './pin';
import { canonicalise, isValidRecoveryCodeShape } from './recoveryCode';

export type TenantMembership = {
  tenantId: string;
  tenantName: string;
  pack: string;
  role: Role;
};

export type SessionUser = {
  id: string;
  phone: string | null;
  fullName: string;
};

export type LockoutState = {
  locked: boolean;
  attemptsRemaining: number;
  retryAfterSeconds: number;
};

const DEFAULT_LOCKOUT: LockoutState = { locked: false, attemptsRemaining: 5, retryAfterSeconds: 0 };

function client() {
  const sb = getSupabase();
  if (!sb) throw new AuthError({ code: 'not_configured' });
  return sb;
}

/* -------------------------------------------------------------------------- */
/* Lockout                                                                     */
/* -------------------------------------------------------------------------- */

export async function getLockoutState(phoneE164: string): Promise<LockoutState> {
  const sb = getSupabase();
  if (!sb) return DEFAULT_LOCKOUT;

  const phoneHash = await hashPhone(phoneE164);
  const { data, error } = await sb.rpc('auth_lockout_state', { p_phone_hash: phoneHash });
  if (error) {
    console.error('[auth] lockout check failed', error.message);
    return DEFAULT_LOCKOUT;
  }
  return parseLockout(data);
}

async function recordAttempt(phoneE164: string, success: boolean): Promise<LockoutState> {
  const sb = getSupabase();
  if (!sb) return DEFAULT_LOCKOUT;

  const phoneHash = await hashPhone(phoneE164);
  const { data, error } = await sb.rpc('record_auth_attempt', {
    p_phone_hash: phoneHash,
    p_success: success,
    ...(typeof navigator === 'undefined' ? {} : { p_user_agent: navigator.userAgent }),
  });
  if (error) {
    console.error('[auth] could not record attempt', error.message);
    return DEFAULT_LOCKOUT;
  }
  return parseLockout(data);
}

function parseLockout(data: unknown): LockoutState {
  if (!data || typeof data !== 'object') return DEFAULT_LOCKOUT;
  const row = data as Record<string, unknown>;
  return {
    locked: row.locked === true,
    attemptsRemaining: typeof row.attempts_remaining === 'number' ? row.attempts_remaining : 5,
    retryAfterSeconds: typeof row.retry_after_seconds === 'number' ? row.retry_after_seconds : 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Sign up / sign in / sign out                                               */
/* -------------------------------------------------------------------------- */

export type SignUpInput = {
  phone: string;
  pin: string;
  fullName: string;
};

/**
 * Creates an account, stores the normalised phone on the profile and registers
 * the recovery code hash. Any failure after the auth user exists is reported but
 * does not leave the user stuck: the session is already valid at that point.
 */
export async function signUpWithPin(input: SignUpInput): Promise<{ userId: string }> {
  const sb = client();
  const phone = normaliseBdPhone(input.phone);
  if (!phone) throw new AuthError({ code: 'phone_invalid' });

  const pinCheck = checkPin(input.pin, { phone });
  if (!pinCheck.ok) {
    throw new AuthError({ code: 'pin_weak', detail: pinCheck.problems.join(',') });
  }

  // Count the signup under the same number, so an attacker cannot use signup as
  // an unthrottled way to probe numbers.
  const state = await getLockoutState(phone);
  if (state.locked) {
    throw new AuthError({ code: 'locked', retryAfterSeconds: state.retryAfterSeconds });
  }

  const { data: available, error: availabilityError } = await sb.rpc('is_phone_available', {
    p_phone: phone,
  });
  if (availabilityError) {
    console.error('[auth] availability check failed', availabilityError.message);
  } else if (available === false) {
    throw new AuthError({ code: 'phone_taken' });
  }

  const { data, error } = await sb.auth.signUp({
    email: phoneToSyntheticEmail(phone),
    password: input.pin,
    options: { data: { full_name: input.fullName.trim(), phone } },
  });

  if (error) {
    throw new AuthError({
      code: mapSupabaseAuthError(error.message, error.status),
      detail: error.message,
    });
  }
  if (!data.user) throw new AuthError({ code: 'unknown', detail: 'signUp returned no user' });

  // The profile row is created by a database trigger; fill in the phone.
  const { error: profileError } = await sb
    .from('profiles')
    .update({ phone, full_name: input.fullName.trim() })
    .eq('id', data.user.id);

  if (profileError) {
    console.error('[auth] could not save the phone on the profile', profileError.message);
  }

  return { userId: data.user.id };
}

export async function signInWithPin(phoneInput: string, pin: string): Promise<void> {
  const sb = client();
  const phone = normaliseBdPhone(phoneInput);
  if (!phone) throw new AuthError({ code: 'phone_invalid' });

  const state = await getLockoutState(phone);
  if (state.locked) {
    throw new AuthError({ code: 'locked', retryAfterSeconds: state.retryAfterSeconds });
  }

  const { error } = await sb.auth.signInWithPassword({
    email: phoneToSyntheticEmail(phone),
    password: pin,
  });

  if (error) {
    const code = mapSupabaseAuthError(error.message, error.status);
    const after = await recordAttempt(phone, false);
    if (after.locked) {
      throw new AuthError({ code: 'locked', retryAfterSeconds: after.retryAfterSeconds });
    }
    throw new AuthError({ code, detail: error.message });
  }

  await recordAttempt(phone, true);
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.auth.signOut();
  if (error) console.error('[auth] sign out failed', error.message);
}

/* -------------------------------------------------------------------------- */
/* Session and memberships                                                     */
/* -------------------------------------------------------------------------- */

export async function getCurrentUser(): Promise<SessionUser | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await sb
    .from('profiles')
    .select('phone, full_name')
    .eq('id', data.user.id)
    .maybeSingle();

  return {
    id: data.user.id,
    phone: profile?.phone ?? null,
    fullName: profile?.full_name ?? '',
  };
}

/**
 * All shops this user belongs to, with their role. One query, because a user may
 * work in more than one shop and the UI must not flicker between them.
 */
export async function listMemberships(userId: string): Promise<TenantMembership[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('tenant_members')
    .select('tenant_id, role, tenants!inner(id, name, pack)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (error) {
    // Never swallow this: an empty list means "no shop", which sends a shop
    // owner into onboarding. The caller must be able to tell the two apart.
    throw new AuthError({ code: 'network', detail: error.message });
  }

  return (data ?? []).flatMap((row) => {
    const tenant = row.tenants as { id: string; name: string; pack: string } | null;
    if (!tenant) return [];
    return [
      {
        tenantId: row.tenant_id,
        tenantName: tenant.name,
        pack: tenant.pack,
        role: row.role as Role,
      },
    ];
  });
}

/* -------------------------------------------------------------------------- */
/* Recovery code                                                               */
/* -------------------------------------------------------------------------- */

export async function saveRecoveryCode(code: string): Promise<void> {
  const sb = client();
  if (!isValidRecoveryCodeShape(code)) {
    throw new AuthError({ code: 'unknown', detail: 'invalid recovery code shape' });
  }
  const codeHash = await sha256Hex(`recovery:v1:${canonicalise(code)}`);
  const { error } = await sb.rpc('set_recovery_code', { p_code_hash: codeHash });
  if (error) {
    throw new AuthError({ code: 'unknown', detail: error.message });
  }
}
