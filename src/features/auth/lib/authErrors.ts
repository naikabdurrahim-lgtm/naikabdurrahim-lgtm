/**
 * Every auth failure becomes one of these codes. The UI maps the code to a
 * Bangla sentence from the locale files — raw Supabase messages are never shown
 * (PROJECT_RULES 3.1 #9).
 */
/** Runtime list, so a test can prove every code has a Bangla sentence. */
export const AUTH_ERROR_CODES = [
  'invalid_credentials',
  'locked',
  'phone_taken',
  'phone_invalid',
  'pin_weak',
  'pin_mismatch',
  'rate_limited',
  'email_not_confirmed',
  'not_configured',
  'network',
  'weak_password', // Supabase rejects a PIN shorter than the project minimum
  'unknown',
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export type AuthFailure = {
  code: AuthErrorCode;
  /** Only present for `locked`: seconds until another attempt is allowed. */
  retryAfterSeconds?: number;
  /** Technical detail for the console, never for the screen. */
  detail?: string;
};

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly retryAfterSeconds?: number;

  constructor(failure: AuthFailure) {
    super(failure.detail ?? failure.code);
    this.name = 'AuthError';
    this.code = failure.code;
    if (failure.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = failure.retryAfterSeconds;
    }
  }
}

/** Maps a Supabase auth error onto our codes. */
export function mapSupabaseAuthError(message: string, status?: number): AuthErrorCode {
  const text = message.toLowerCase();

  if (text.includes('invalid login credentials')) return 'invalid_credentials';
  if (text.includes('email not confirmed')) return 'email_not_confirmed';
  if (text.includes('already registered') || text.includes('already been registered')) {
    return 'phone_taken';
  }
  if (text.includes('password should be at least') || text.includes('weak password')) {
    return 'weak_password';
  }
  if (text.includes('rate limit') || text.includes('too many requests') || status === 429) {
    return 'rate_limited';
  }
  if (text.includes('failed to fetch') || text.includes('network')) return 'network';
  return 'unknown';
}
