import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import bnAuth from '@/locales/bn/auth.json';
import bnCommon from '@/locales/bn/common.json';
import bnOnboarding from '@/locales/bn/onboarding.json';
import bnProducts from '@/locales/bn/products.json';
import enAuth from '@/locales/en/auth.json';
import enCommon from '@/locales/en/common.json';
import enOnboarding from '@/locales/en/onboarding.json';
import enProducts from '@/locales/en/products.json';

export const SUPPORTED_LANGUAGES = ['bn', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = 'bn';

/**
 * Namespaces are split per feature (`common`, `auth`, `onboarding`, …). Every
 * module gets loaded eagerly for now: the whole set is a few kB and offline
 * start-up must never wait on a chunk.
 */
export const NAMESPACES = ['common', 'auth', 'onboarding', 'products'] as const;
export type AppNamespace = (typeof NAMESPACES)[number];

export const resources = {
  bn: { common: bnCommon, auth: bnAuth, onboarding: bnOnboarding, products: bnProducts },
  en: { common: enCommon, auth: enAuth, onboarding: enOnboarding, products: enProducts },
} as const;

export const i18nReady = i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  ns: [...NAMESPACES],
  defaultNS: 'common',
  interpolation: {
    // React already escapes output; double-escaping would show &amp; in Bangla text.
    escapeValue: false,
  },
  returnNull: false,
});

export function isAppLanguage(value: string | undefined | null): value is AppLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export default i18n;
