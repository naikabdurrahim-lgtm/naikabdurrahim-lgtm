import { describe, expect, it } from 'vitest';
import bnAuth from '@/locales/bn/auth.json';
import bnCommon from '@/locales/bn/common.json';
import bnOnboarding from '@/locales/bn/onboarding.json';
import bnPos from '@/locales/bn/pos.json';
import bnProducts from '@/locales/bn/products.json';
import enAuth from '@/locales/en/auth.json';
import enCommon from '@/locales/en/common.json';
import enOnboarding from '@/locales/en/onboarding.json';
import enPos from '@/locales/en/pos.json';
import enProducts from '@/locales/en/products.json';
import { DEFAULT_LANGUAGE, NAMESPACES, SUPPORTED_LANGUAGES, isAppLanguage } from './index';

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

function valueAt(dict: Json, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    return acc !== null && typeof acc === 'object' ? (acc as Json)[part] : undefined;
  }, dict);
}

const PAIRS = [
  { ns: 'common', bn: bnCommon, en: enCommon },
  { ns: 'auth', bn: bnAuth, en: enAuth },
  { ns: 'onboarding', bn: bnOnboarding, en: enOnboarding },
  { ns: 'products', bn: bnProducts, en: enProducts },
  { ns: 'pos', bn: bnPos, en: enPos },
];

describe.each(PAIRS)('locale parity — $ns', ({ bn, en }) => {
  it('bn and en expose exactly the same keys', () => {
    expect(flattenKeys(en as Json).sort()).toEqual(flattenKeys(bn as Json).sort());
  });

  it('has no empty translations', () => {
    for (const [lang, dict] of Object.entries({ bn, en })) {
      for (const key of flattenKeys(dict as Json)) {
        const value = valueAt(dict as Json, key);
        expect(typeof value, `${lang}:${key}`).toBe('string');
        expect((value as string).trim(), `${lang}:${key}`).not.toBe('');
      }
    }
  });
});

describe('i18n setup', () => {
  it('ships every namespace for both languages', () => {
    expect(NAMESPACES).toEqual(['common', 'auth', 'onboarding', 'products', 'pos', 'customers']);
    expect(SUPPORTED_LANGUAGES).toEqual(['bn', 'en']);
  });

  it('accepts supported languages only', () => {
    expect(isAppLanguage('bn')).toBe(true);
    expect(isAppLanguage('en')).toBe(true);
    expect(isAppLanguage('fr')).toBe(false);
    expect(isAppLanguage(undefined)).toBe(false);
  });

  it('defaults to Bangla', () => {
    expect(DEFAULT_LANGUAGE).toBe('bn');
  });
});
