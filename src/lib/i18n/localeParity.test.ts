import { describe, expect, it } from 'vitest';
import bn from '@/locales/bn/common.json';
import en from '@/locales/en/common.json';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, isAppLanguage } from './index';

type Json = Record<string, unknown>;

function flattenKeys(value: Json, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
      return flattenKeys(child as Json, path);
    }
    return [path];
  });
}

describe('locale parity', () => {
  const bnKeys = flattenKeys(bn as Json).sort();
  const enKeys = flattenKeys(en as Json).sort();

  it('bn and en expose exactly the same keys', () => {
    expect(enKeys).toEqual(bnKeys);
  });

  it('has no empty translations', () => {
    for (const [lang, dict] of Object.entries({ bn, en })) {
      for (const key of flattenKeys(dict as Json)) {
        const value = key.split('.').reduce<unknown>((acc, part) => {
          return acc !== null && typeof acc === 'object' ? (acc as Json)[part] : undefined;
        }, dict);
        expect(typeof value, `${lang}:${key}`).toBe('string');
        expect((value as string).trim(), `${lang}:${key}`).not.toBe('');
      }
    }
  });
});

describe('language guards', () => {
  it('accepts supported languages only', () => {
    expect(isAppLanguage('bn')).toBe(true);
    expect(isAppLanguage('en')).toBe(true);
    expect(isAppLanguage('fr')).toBe(false);
    expect(isAppLanguage(undefined)).toBe(false);
  });

  it('defaults to Bangla', () => {
    expect(DEFAULT_LANGUAGE).toBe('bn');
    expect(SUPPORTED_LANGUAGES).toContain('bn');
  });
});
