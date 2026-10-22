import { describe, expect, it } from 'vitest';

import bnAuth from '@/locales/bn/auth.json';
import enAuth from '@/locales/en/auth.json';

import { AUTH_ERROR_CODES, AuthError, mapSupabaseAuthError } from './authErrors';

describe('every auth failure has a human sentence', () => {
  it('has a Bangla message for each code (PROJECT_RULES 3.1 #9)', () => {
    for (const code of AUTH_ERROR_CODES) {
      const message = (bnAuth.errors as Record<string, string>)[code];
      expect(message, `missing bn auth.errors.${code}`).toBeTruthy();
      // A Bangla sentence, not an English placeholder.
      expect(message).toMatch(/[\u0980-\u09FF]/);
    }
  });

  it('has an English message for each code', () => {
    for (const code of AUTH_ERROR_CODES) {
      expect((enAuth.errors as Record<string, string>)[code]).toBeTruthy();
    }
  });

  it('has no locale key that no code produces', () => {
    const codes = new Set<string>(AUTH_ERROR_CODES);
    for (const key of Object.keys(bnAuth.errors)) expect(codes.has(key)).toBe(true);
  });
});

describe('mapSupabaseAuthError', () => {
  it('recognises the messages Supabase actually returns', () => {
    expect(mapSupabaseAuthError('Invalid login credentials')).toBe('invalid_credentials');
    expect(mapSupabaseAuthError('Email not confirmed')).toBe('email_not_confirmed');
    expect(mapSupabaseAuthError('User already registered')).toBe('phone_taken');
    expect(mapSupabaseAuthError('Password should be at least 6 characters')).toBe('weak_password');
  });

  it('treats 429 and rate-limit wording as a rate limit', () => {
    expect(mapSupabaseAuthError('Too many requests', 429)).toBe('rate_limited');
    expect(mapSupabaseAuthError('Request rate limit reached')).toBe('rate_limited');
  });

  it('recognises a dropped connection as a network problem, not a bad PIN', () => {
    expect(mapSupabaseAuthError('TypeError: Failed to fetch')).toBe('network');
    expect(mapSupabaseAuthError('NetworkError when attempting to fetch resource.')).toBe('network');
  });

  it('falls back to unknown instead of leaking the raw message', () => {
    expect(mapSupabaseAuthError('PGRST301: JWT expired')).toBe('unknown');
    expect(mapSupabaseAuthError('')).toBe('unknown');
  });
});

describe('AuthError', () => {
  it('carries the code and the lockout countdown', () => {
    const error = new AuthError({ code: 'locked', retryAfterSeconds: 900 });
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('locked');
    expect(error.retryAfterSeconds).toBe(900);
  });

  it('keeps technical detail in the message, never on the screen', () => {
    const error = new AuthError({ code: 'unknown', detail: 'PGRST301: JWT expired' });
    expect(error.message).toBe('PGRST301: JWT expired');
    expect(error.code).toBe('unknown');
  });

  it('leaves retryAfterSeconds undefined when there is no lock', () => {
    expect(new AuthError({ code: 'invalid_credentials' }).retryAfterSeconds).toBeUndefined();
  });
});
