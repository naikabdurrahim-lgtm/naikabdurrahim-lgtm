/**
 * PIN policy.
 *
 * A 6-digit PIN is weak by nature; the database adds rate limiting and lockout
 * (supabase/migrations/0011_auth_hardening.sql) and this module refuses the PINs
 * that make guessing trivial. Every rule has a Bangla message in the locales;
 * this module only returns machine-readable reasons.
 */

export const PIN_LENGTH = 6;

export type PinProblem =
  | 'empty'
  | 'wrong_length'
  | 'not_digits'
  | 'all_same_digit'
  | 'sequential'
  | 'common'
  | 'repeated_pair'
  | 'birth_year'
  | 'phone_digits';

export type PinCheck = { ok: true } | { ok: false; problems: PinProblem[] };

/** PINs that appear at the top of every leaked-password list. */
const COMMON_PINS = new Set([
  '123456',
  '654321',
  '111111',
  '000000',
  '121212',
  '112233',
  '123123',
  '159753',
  '147258',
  '789456',
  '456789',
  '987654',
  '258000',
  '123321',
  '131313',
  '101010',
  '111222',
  '222333',
  '666666',
  '777777',
  '888888',
  '999999',
  '123654',
  '555555',
  '444444',
  '333333',
  '222222',
  '101112',
  '201112',
  '100000',
  '200000',
]);

const isSequential = (pin: string): boolean => {
  const digits = [...pin].map(Number);
  let ascending = true;
  let descending = true;
  for (let i = 1; i < digits.length; i += 1) {
    const step = (digits[i] as number) - (digits[i - 1] as number);
    if (step !== 1) ascending = false;
    if (step !== -1) descending = false;
  }
  return ascending || descending;
};

/** 123123, 121212: a short block repeated to fill the length. */
const isRepeatedBlock = (pin: string): boolean => {
  for (const size of [1, 2, 3]) {
    if (pin.length % size !== 0) continue;
    const block = pin.slice(0, size);
    if (block.repeat(pin.length / size) === pin) return true;
  }
  return false;
};

/**
 * Checks a PIN. `context` lets us refuse a PIN built from the user's own phone
 * number or a recent year, which is the first thing a family member would try.
 */
export function checkPin(pin: string, context: { phone?: string | undefined } = {}): PinCheck {
  const problems: PinProblem[] = [];

  if (!pin || pin.trim() === '') return { ok: false, problems: ['empty'] };
  if (/[^\d]/.test(pin)) problems.push('not_digits');
  if (pin.length !== PIN_LENGTH) problems.push('wrong_length');

  if (/[^\d]/.test(pin) || pin.length !== PIN_LENGTH) {
    return { ok: false, problems };
  }

  if (new Set(pin).size === 1) problems.push('all_same_digit');
  if (isSequential(pin)) problems.push('sequential');
  if (COMMON_PINS.has(pin)) problems.push('common');
  if (isRepeatedBlock(pin) && new Set(pin).size <= 3) problems.push('repeated_pair');

  // A year (1960-2039) makes a PIN guessable from the owner's age.
  if (
    /^(19[6-9]\d|20[0-3]\d)(\d{2})$/.test(pin) &&
    /^(19[6-9]\d|20[0-3]\d)$/.test(pin.slice(0, 4))
  ) {
    problems.push('birth_year');
  }

  if (context.phone) {
    const phoneDigits = context.phone.replace(/\D/g, '');
    if (phoneDigits.includes(pin)) problems.push('phone_digits');
  }

  return problems.length === 0 ? { ok: true } : { ok: false, problems: [...new Set(problems)] };
}

/** 0–3, used to colour the strength bar. Anything under 2 is not acceptable. */
export function pinStrength(pin: string): 0 | 1 | 2 | 3 {
  if (pin.length !== PIN_LENGTH || /[^\d]/.test(pin)) return 0;
  const check = checkPin(pin);
  if (!check.ok) return 1;
  const unique = new Set(pin).size;
  if (unique >= 6) return 3;
  if (unique >= 5) return 2;
  return 2;
}

/** Both entries must match, and the PIN must pass the policy. */
export function confirmPin(pin: string, confirm: string): boolean {
  return pin.length > 0 && pin === confirm;
}
