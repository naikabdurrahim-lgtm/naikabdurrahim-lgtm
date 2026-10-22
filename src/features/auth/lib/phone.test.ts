import { describe, expect, it } from 'vitest';

import {
  formatBdPhone,
  hashPhone,
  normaliseBdPhone,
  normaliseDigits,
  phoneLastFour,
  phoneToSyntheticEmail,
  sha256Hex,
  syntheticEmailToPhone,
  toLocalPhone,
} from './phone';

describe('normaliseBdPhone', () => {
  it('accepts every form a shopkeeper may type', () => {
    const expected = '+8801712345678';
    expect(normaliseBdPhone('01712345678')).toBe(expected);
    expect(normaliseBdPhone('1712345678')).toBe(expected);
    expect(normaliseBdPhone('8801712345678')).toBe(expected);
    expect(normaliseBdPhone('+8801712345678')).toBe(expected);
    expect(normaliseBdPhone('+880 1712-345678')).toBe(expected);
    expect(normaliseBdPhone(' 01712 345 678 ')).toBe(expected);
    expect(normaliseBdPhone('(+880) 1712345678')).toBe(expected);
  });

  it('reads Bangla digits typed on a Bangla keyboard', () => {
    expect(normaliseBdPhone('০১৭১২৩৪৫৬৭৮')).toBe('+8801712345678');
  });

  it('accepts all operator prefixes 013–019', () => {
    for (const prefix of ['13', '14', '15', '16', '17', '18', '19']) {
      expect(normaliseBdPhone(`0${prefix}12345678`)).toBe(`+880${prefix}12345678`);
    }
  });

  it('rejects numbers that are not BD mobiles', () => {
    expect(normaliseBdPhone('01212345678')).toBeNull(); // 012 is not allocated
    expect(normaliseBdPhone('0171234567')).toBeNull(); // one digit short
    expect(normaliseBdPhone('017123456789')).toBeNull(); // one digit long
    expect(normaliseBdPhone('+88001712345678')).toBeNull(); // double zero
    expect(normaliseBdPhone('0171234567a')).toBeNull();
    expect(normaliseBdPhone('')).toBeNull();
    expect(normaliseBdPhone('   ')).toBeNull();
    // @ts-expect-error — runtime guard for callers that skip validation
    expect(normaliseBdPhone(undefined)).toBeNull();
  });
});

describe('display helpers', () => {
  it('formats for humans and for hints', () => {
    expect(formatBdPhone('+8801712345678')).toBe('01712-345678');
    expect(toLocalPhone('+8801712345678')).toBe('01712345678');
    expect(phoneLastFour('+8801712345678')).toBe('5678');
  });

  it('returns the input untouched when it cannot be parsed', () => {
    expect(formatBdPhone('not-a-phone')).toBe('not-a-phone');
    expect(toLocalPhone('not-a-phone')).toBeNull();
  });
});

describe('normaliseDigits', () => {
  it('is lossless in both directions', () => {
    expect(normaliseDigits('০১২৩৪৫৬৭৮৯')).toBe('0123456789');
    expect(normaliseDigits('abc১২x')).toBe('abc12x');
    expect(normaliseDigits('123')).toBe('123');
  });
});

describe('synthetic email', () => {
  it('round-trips phone → email → phone', () => {
    const email = phoneToSyntheticEmail('+8801712345678');
    // The address keeps all 13 E.164 digits (880 + 10) and drops only the "+",
    // so two different phones can never share a mailbox.
    expect(email).toBe('8801712345678@phone.dokanbondhu.local');
    expect(syntheticEmailToPhone(email)).toBe('+8801712345678');
  });

  it('is deterministic, so the same phone always reaches the same account', () => {
    expect(phoneToSyntheticEmail('+8801911111111')).toBe(phoneToSyntheticEmail('+8801911111111'));
    expect(phoneToSyntheticEmail('+8801911111111')).not.toBe(
      phoneToSyntheticEmail('+8801911111112'),
    );
  });

  it('rejects anything that is not one of our synthetic addresses', () => {
    expect(syntheticEmailToPhone('someone@gmail.com')).toBeNull();
    expect(syntheticEmailToPhone('1712345678@phone.dokanbondhu.local ')).toBeNull();
    expect(syntheticEmailToPhone('171234567@phone.dokanbondhu.local')).toBeNull();
    expect(syntheticEmailToPhone('8801712345678@phone.dokanbondhu.local')).toBe('+8801712345678');
  });
});

describe('hashing', () => {
  it('hashes to 64 lowercase hex characters', async () => {
    const hash = await hashPhone('+8801712345678');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable across calls but different per phone', async () => {
    const a = await hashPhone('+8801712345678');
    const b = await hashPhone('+8801712345678');
    const c = await hashPhone('+8801712345679');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('never contains the phone number itself', async () => {
    expect(await hashPhone('+8801712345678')).not.toContain('1712345678');
  });

  it('salt-prefixes the hash so it cannot be matched against a generic phone-hash table', async () => {
    const raw = await sha256Hex('+8801712345678');
    expect(await hashPhone('+8801712345678')).not.toBe(raw);
  });
});
