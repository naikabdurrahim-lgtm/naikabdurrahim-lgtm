/**
 * Bangladeshi phone numbers and the synthetic email used for Supabase Auth.
 *
 * Why a synthetic email: Supabase phone sign-in needs a paid SMS provider, so
 * Phase 3 uses email/password with an address derived from the phone number.
 * The address is never shown to the user and never receives mail.
 *
 * Security note: the phone number is the public half of the login. It is always
 * normalised to E.164 (+8801XXXXXXXXX) before it is stored, hashed or sent.
 */

/** Map of local prefixes so a shopkeeper can type 017… or 8801… or +8801…. */
const BD_MOBILE = /^(\+?880|0)?(1[3-9]\d{8})$/;

/** Bangla digits → ASCII, so a Bangla keyboard does not break the field. */
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function normaliseDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/**
 * Accepts 01XXXXXXXXX, 8801XXXXXXXXX, +8801XXXXXXXXX, with spaces or dashes.
 * Returns E.164 form or null when the number is not a valid BD mobile.
 */
export function normaliseBdPhone(input: string): string | null {
  if (typeof input !== 'string') return null;
  const cleaned = normaliseDigits(input).replace(/[\s\-()]/g, '');
  const match = BD_MOBILE.exec(cleaned);
  if (!match?.[2]) return null;
  return `+880${match[2]}`;
}

/** Pretty form for display: 01712-345678. */
export function formatBdPhone(e164: string): string {
  const local = toLocalPhone(e164);
  if (!local) return e164;
  return `${local.slice(0, 5)}-${local.slice(5)}`;
}

/** 11-digit local form (01712345678) or null. */
export function toLocalPhone(input: string): string | null {
  const e164 = normaliseBdPhone(input);
  if (!e164) return null;
  return `0${e164.slice(4)}`;
}

/** Last four digits, for "…৭৮৯০" style hints in the UI. */
export function phoneLastFour(e164: string): string {
  return e164.slice(-4);
}

/**
 * Synthetic email for Supabase Auth. Deterministic, so the same phone always
 * maps to the same account. The shared secret is not needed here because the
 * domain is not a real mailbox and the PIN is what protects the account.
 */
export function phoneToSyntheticEmail(e164Phone: string): string {
  const digits = e164Phone.replace(/\D/g, '');
  return `${digits}@phone.dokanbondhu.local`;
}

/** Reverses phoneToSyntheticEmail for display in the account screen. */
export function syntheticEmailToPhone(email: string): string | null {
  const match = /^(\d{13})@phone\.dokanbondhu\.local$/.exec(email);
  if (!match?.[1]) return null;
  return normaliseBdPhone(`+${match[1]}`);
}

/**
 * SHA-256 hex of the phone number. Sent to the lockout RPC and used as the
 * attempt key, so the attempt log never stores a phone number.
 * WebCrypto is available in every browser we support and in Node 18+.
 */
export async function hashPhone(e164Phone: string): Promise<string> {
  const data = new TextEncoder().encode(`phone:v1:${e164Phone}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Generic SHA-256 hex helper, used for recovery codes too. */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
