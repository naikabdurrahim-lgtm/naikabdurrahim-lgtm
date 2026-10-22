import { useEffect, type ReactNode } from 'react';
import { usePreferences, resolveAppearance } from '@/features/settings/preferences';
import i18n, { isAppLanguage } from '@/lib/i18n';

/**
 * Applies preferences to the document root so CSS variables (theme, accent,
 * font size) and `lang`/`dir` attributes stay in sync with the store.
 * Kept as an effect rather than inline attributes so the DOM stays the single
 * place components read styling from.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { language, appearance, accent, fontSize } = usePreferences();

  // Language
  useEffect(() => {
    if (!isAppLanguage(language)) return;
    document.documentElement.lang = language;
    void i18n.changeLanguage(language);
  }, [language]);

  // Theme / accent / font size
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const resolved = resolveAppearance(appearance, media.matches);
      root.classList.toggle('light', resolved === 'light');
      root.classList.toggle('dark', resolved === 'dark');
      root.style.colorScheme = resolved;
      const themeColor = resolved === 'dark' ? '#0b1020' : '#f8fafc';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
    };

    apply();
    if (appearance !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [appearance]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = accent;
    root.dataset.fontSize = fontSize;
  }, [accent, fontSize]);

  return children;
}
