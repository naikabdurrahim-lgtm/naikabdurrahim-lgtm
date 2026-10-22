/**
 * Account recovery codes.
 *
 * Without SMS, a forgotten PIN has no self-service path. A recovery code is the
 * honest alternative: high entropy, generated on the device, shown once, and
 * stored server-side only as a SHA-256 hash.
 *
 * The code is 12 characters from a 32-symbol alphabet that avoids the worst
 * look-alikes (no I, O, 0 or 1 — A–Z minus I/O, plus 2–9 = 32 symbols),
 * displayed as three groups of four: ABCD-EFGH-JKLM.
 * Entropy: 12 × 5 bits = 60 bits, far beyond guessing, and short enough for a
 * shopkeeper to copy onto paper.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 symbols, no look-alikes
const GROUPS = 3;
const GROUP_SIZE = 4;
export const RECOVERY_CODE_LENGTH = GROUPS * GROUP_SIZE;

/** Cryptographically random code, formatted as ABCD-EFGH-JKLM. */
export function generateRecoveryCode(): string {
  const bytes = new Uint8Array(RECOVERY_CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);

  let raw = '';
  for (const byte of bytes) {
    // 32 symbols → 5 bits; modulo 32 has no bias.
    raw += ALPHABET[byte % ALPHABET.length];
  }
  return formatRecoveryCode(raw);
}

/** Uppercases, strips separators, then regroups. Safe for pasted input. */
export function formatRecoveryCode(input: string): string {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const groups: string[] = [];
  for (let i = 0; i < clean.length && groups.length < GROUPS; i += GROUP_SIZE) {
    groups.push(clean.slice(i, i + GROUP_SIZE));
  }
  return groups.join('-');
}

export function isValidRecoveryCodeShape(input: string): boolean {
  const formatted = formatRecoveryCode(input);
  if (formatted.length !== RECOVERY_CODE_LENGTH + GROUPS - 1) return false;
  return [...formatted.replace(/-/g, '')].every((char) => ALPHABET.includes(char));
}

/**
 * What we send to the server: the hash of the code in canonical form, so
 * "abcd-efgh-jklm" and "ABCDEFGHJKLM" are the same code.
 */
export function canonicalise(code: string): string {
  return formatRecoveryCode(code).replace(/-/g, '');
}
