import { describe, expect, it } from 'vitest';

import {
  canonicalise,
  formatRecoveryCode,
  generateRecoveryCode,
  isValidRecoveryCodeShape,
  RECOVERY_CODE_LENGTH,
} from './recoveryCode';

describe('generateRecoveryCode', () => {
  it('produces three groups of four, ABCD-EFGH-JKLM', () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(code).toHaveLength(RECOVERY_CODE_LENGTH + 2);
  });

  it('never uses the look-alike characters I, O, 0 or 1', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateRecoveryCode()).not.toMatch(/[IO01]/);
    }
  });

  it('does not repeat across 500 draws', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateRecoveryCode()));
    expect(codes.size).toBe(500);
  });

  it('always passes its own shape check', () => {
    for (let i = 0; i < 100; i += 1) {
      expect(isValidRecoveryCodeShape(generateRecoveryCode())).toBe(true);
    }
  });
});

describe('formatRecoveryCode', () => {
  it('forgives how the user types or pastes it', () => {
    const expected = 'ABCD-EFGH-JKLM';
    expect(formatRecoveryCode('abcdefghjklm')).toBe(expected);
    expect(formatRecoveryCode('ABCD EFGH JKLM')).toBe(expected);
    expect(formatRecoveryCode('abcd-efgh-jklm')).toBe(expected);
    expect(formatRecoveryCode('  ABCD_EFGH_JKLM  ')).toBe(expected);
    expect(formatRecoveryCode('ABCDEFGHJKLM')).toBe(expected);
  });

  it('drops anything past three groups', () => {
    expect(formatRecoveryCode('ABCDEFGHJKLMNPQR')).toBe('ABCD-EFGH-JKLM');
  });

  it('strips characters that are not part of the alphabet', () => {
    expect(formatRecoveryCode('ab!cd@ef#gh$jk%lm')).toBe('ABCD-EFGH-JKLM');
  });
});

describe('isValidRecoveryCodeShape', () => {
  it('rejects short, long and look-alike codes', () => {
    expect(isValidRecoveryCodeShape('')).toBe(false);
    expect(isValidRecoveryCodeShape('ABCD-EFGH-JKL')).toBe(false);
    // A longer paste is cut to the first three groups (see formatRecoveryCode);
    // a wrong code still fails on the hash, so truncation is safe.
    expect(isValidRecoveryCodeShape('ABCD-EFGH-JKLMN')).toBe(true);
    expect(isValidRecoveryCodeShape('ABCD-EFGH-JKLI')).toBe(false); // I is not in the alphabet
    expect(isValidRecoveryCodeShape('ABCD-EFGH-JKLE')).toBe(true);
  });
});

describe('canonicalise', () => {
  it('gives one hashable form for every way of writing the code', () => {
    const forms = ['abcd-efgh-jklm', 'ABCD EFGH JKLM', 'ABCDEFGHJKLM', ' Abcd-Efgh-Jklm '];
    const canonical = forms.map(canonicalise);
    expect(new Set(canonical).size).toBe(1);
    expect(canonical[0]).toBe('ABCDEFGHJKLM');
  });
});
