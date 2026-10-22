import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import bnCommon from '@/locales/bn/common.json';
import enCommon from '@/locales/en/common.json';

export const SUPPORTED_LANGUAGES = ['bn', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = 'bn';

/** Namespaces are split per feature later; `common` holds shared UI strings. */
export const resources = {
  bn: { common: bnCommon },
  en: { common: enCommon },
} as const;

export const i18nReady = i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  defaultNS: 'common',
  ns: ['common'],
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
