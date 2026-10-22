import { describe, expect, it } from 'vitest';

import { checkPin, confirmPin, PIN_LENGTH, pinStrength, type PinProblem } from './pin';

const problemsOf = (pin: string): PinProblem[] => {
  const result = checkPin(pin);
  return result.ok ? [] : result.problems;
};

describe('PIN_LENGTH', () => {
  it('is the six digits the sign-in screen renders', () => {
    expect(PIN_LENGTH).toBe(6);
  });
});

describe('checkPin — accepts a PIN a human can actually remember', () => {
  it.each(['482915', '739261', '906374', '284057'])('%s is accepted', (pin) => {
    expect(checkPin(pin)).toEqual({ ok: true });
  });
});

describe('checkPin — problems', () => {
  it('flags an empty PIN', () => {
    expect(problemsOf('')).toEqual(['empty']);
    expect(problemsOf('   ')).toEqual(['empty']);
  });

  it('flags letters and non-ASCII digits', () => {
    // Bangla digits are converted by the input component, not here.
    expect(problemsOf('12ab56')).toEqual(['not_digits']);
    expect(problemsOf('১২৩৪৫৬')).toEqual(['not_digits']);
  });

  it('flags the wrong length', () => {
    expect(problemsOf('12345')).toEqual(['wrong_length']);
    expect(problemsOf('1234567')).toEqual(['wrong_length']);
  });

  it('flags six identical digits', () => {
    expect(problemsOf('000000')).toContain('all_same_digit');
    expect(problemsOf('777777')).toContain('all_same_digit');
  });

  it('flags ascending and descending runs', () => {
    expect(problemsOf('123456')).toContain('sequential');
    expect(problemsOf('987654')).toContain('sequential');
    expect(problemsOf('345678')).toContain('sequential');
  });

  it('flags leaked top-30 PINs', () => {
    expect(problemsOf('159753')).toContain('common');
    expect(problemsOf('112233')).toContain('common');
  });

  it('flags a repeated block', () => {
    expect(problemsOf('121212')).toContain('repeated_pair');
    expect(problemsOf('405405')).toContain('repeated_pair');
  });

  it('flags a birth-year PIN', () => {
    expect(problemsOf('199012')).toContain('birth_year');
    expect(problemsOf('200315')).toContain('birth_year');
    // 2045 is beyond the plausible range, so it is not guessed as a year.
    expect(problemsOf('204512')).not.toContain('birth_year');
  });

  it('flags a PIN hidden inside the owner’s own phone number', () => {
    const phone = '+8801712345678';
    expect(checkPin('712345', { phone })).toEqual({
      ok: false,
      problems: ['phone_digits'],
    });
    // Not every part of the number is inside it.
    expect(checkPin('901238', { phone }).ok).toBe(true);
  });

  it('reports every problem at once, without duplicates', () => {
    const problems = problemsOf('111111');
    expect(problems).toContain('all_same_digit');
    expect(problems).toContain('repeated_pair');
    expect(new Set(problems).size).toBe(problems.length);
  });
});

describe('pinStrength', () => {
  it('scores 0 for an incomplete or non-numeric value', () => {
    expect(pinStrength('')).toBe(0);
    expect(pinStrength('12345')).toBe(0);
    expect(pinStrength('12a456')).toBe(0);
  });

  it('scores 1 for a rejected PIN', () => {
    expect(pinStrength('123456')).toBe(1);
    expect(pinStrength('000000')).toBe(1);
  });

  it('scores higher as distinct digits increase', () => {
    expect(pinStrength('482915')).toBe(3);
    expect(pinStrength('482912')).toBe(2);
  });
});

describe('confirmPin', () => {
  it('requires both entries to match and to be non-empty', () => {
    expect(confirmPin('482915', '482915')).toBe(true);
    expect(confirmPin('482915', '482916')).toBe(false);
    expect(confirmPin('', '')).toBe(false);
  });
});
