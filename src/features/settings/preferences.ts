import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_LANGUAGE, type AppLanguage } from '@/lib/i18n';

export const ACCENTS = ['teal', 'blue', 'purple', 'pink', 'amber'] as const;
export type Accent = (typeof ACCENTS)[number];

export const APPEARANCES = ['dark', 'light', 'system'] as const;
export type Appearance = (typeof APPEARANCES)[number];

export const FONT_SIZES = ['sm', 'md', 'lg'] as const;
export type FontSize = (typeof FONT_SIZES)[number];

export const APP_MODES = ['simple', 'pro'] as const;
export type AppMode = (typeof APP_MODES)[number];

export const NUMERAL_STYLES = ['bn', 'en'] as const;
export type NumeralStyle = (typeof NUMERAL_STYLES)[number];

export type Preferences = {
  language: AppLanguage;
  mode: AppMode;
  appearance: Appearance;
  accent: Accent;
  fontSize: FontSize;
  numerals: NumeralStyle;
};

export type PreferencesActions = {
  setLanguage: (language: AppLanguage) => void;
  setMode: (mode: AppMode) => void;
  setAppearance: (appearance: Appearance) => void;
  setAccent: (accent: Accent) => void;
  setFontSize: (fontSize: FontSize) => void;
  setNumerals: (numerals: NumeralStyle) => void;
  reset: () => void;
};

/**
 * UI-only preferences. Business data never lives here — it belongs to the
 * tenant in Postgres/Dexie. `partialize` keeps the stored payload small and
 * prevents accidental persistence of future transient state.
 *
 * New users start in Simple Mode, Bangla, Bangla numerals and dark theme
 * (PROJECT_RULES 3.1 #4, 3.2, 3.1 #7).
 */
export const defaultPreferences: Preferences = {
  language: DEFAULT_LANGUAGE,
  mode: 'simple',
  appearance: 'dark',
  accent: 'teal',
  fontSize: 'md',
  numerals: 'bn',
};

const STORAGE_KEY = 'dokan-bondhu.prefs.v1';

export const usePreferences = create<Preferences & PreferencesActions>()(
  persist(
    (set) => ({
      ...defaultPreferences,
      setLanguage: (language) => set({ language }),
      setMode: (mode) => set({ mode }),
      setAppearance: (appearance) => set({ appearance }),
      setAccent: (accent) => set({ accent }),
      setFontSize: (fontSize) => set({ fontSize }),
      setNumerals: (numerals) => set({ numerals }),
      reset: () => set({ ...defaultPreferences }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: ({ language, mode, appearance, accent, fontSize, numerals }) => ({
        language,
        mode,
        appearance,
        accent,
        fontSize,
        numerals,
      }),
    },
  ),
);

export function resolveAppearance(appearance: Appearance, prefersDark: boolean): 'dark' | 'light' {
  if (appearance === 'system') return prefersDark ? 'dark' : 'light';
  return appearance;
}
