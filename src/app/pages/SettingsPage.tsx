import type { ReactNode } from 'react';
import { Check, Languages, Palette, SlidersHorizontal, Type } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MoneyText } from '@/components/common/MoneyText';
import { Button } from '@/components/ui/button';
import {
  ACCENTS,
  APPEARANCES,
  APP_MODES,
  FONT_SIZES,
  NUMERAL_STYLES,
  usePreferences,
  type Accent,
} from '@/features/settings/preferences';
import type { AppLanguage } from '@/lib/i18n';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { cn } from '@/lib/utils';

const accentSwatch: Record<Accent, string> = {
  teal: 'bg-[hsl(var(--swatch-teal))]',
  blue: 'bg-[hsl(var(--swatch-blue))]',
  purple: 'bg-[hsl(var(--swatch-purple))]',
  pink: 'bg-[hsl(var(--swatch-pink))]',
  amber: 'bg-[hsl(var(--swatch-amber))]',
};

/**
 * Settings that exist from Phase 1 because they shape every later screen:
 * theme, accent, text size, numerals, language and Simple/Pro mode.
 * All choices persist locally and apply immediately.
 */
export function SettingsPage() {
  const { t, language, changeLanguage } = useAppTranslation();
  const prefs = usePreferences();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
      </header>

      {/* Mode */}
      <Section icon={SlidersHorizontal} title={t('settings.mode')}>
        <div className="grid grid-cols-2 gap-3">
          {APP_MODES.map((mode) => {
            const active = prefs.mode === mode;
            return (
              <ChoiceButton
                key={mode}
                active={active}
                onClick={() => prefs.setMode(mode)}
                label={mode === 'simple' ? t('settings.modeSimple') : t('settings.modePro')}
                hint={mode === 'simple' ? t('settings.modeSimpleHint') : t('settings.modeProHint')}
              />
            );
          })}
        </div>
      </Section>

      {/* Appearance */}
      <Section icon={Palette} title={t('settings.appearance')}>
        <div className="grid grid-cols-3 gap-2">
          {APPEARANCES.map((value) => (
            <ChoiceButton
              key={value}
              active={prefs.appearance === value}
              onClick={() => prefs.setAppearance(value)}
              label={
                value === 'dark'
                  ? t('settings.appearanceDark')
                  : value === 'light'
                    ? t('settings.appearanceLight')
                    : t('settings.appearanceSystem')
              }
            />
          ))}
        </div>
      </Section>

      {/* Accent */}
      <Section icon={Palette} title={t('settings.accent')}>
        <div role="radiogroup" aria-label={t('settings.accent')} className="flex flex-wrap gap-3">
          {ACCENTS.map((accent) => {
            const active = prefs.accent === accent;
            const label =
              accent === 'teal'
                ? t('settings.accentTeal')
                : accent === 'blue'
                  ? t('settings.accentBlue')
                  : accent === 'purple'
                    ? t('settings.accentPurple')
                    : accent === 'pink'
                      ? t('settings.accentPink')
                      : t('settings.accentAmber');
            return (
              <button
                key={accent}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={label}
                title={label}
                onClick={() => prefs.setAccent(accent)}
                className={cn(
                  'grid size-touch place-items-center rounded-full border-2 transition',
                  active ? 'border-foreground' : 'border-transparent',
                )}
              >
                <span
                  className={cn(
                    'grid size-10 place-items-center rounded-full',
                    accentSwatch[accent],
                  )}
                >
                  {active ? <Check aria-hidden="true" className="size-5 text-background" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Text size */}
      <Section icon={Type} title={t('settings.fontSize')}>
        <div className="grid grid-cols-3 gap-2">
          {FONT_SIZES.map((size) => (
            <ChoiceButton
              key={size}
              active={prefs.fontSize === size}
              onClick={() => prefs.setFontSize(size)}
              label={
                size === 'sm'
                  ? t('settings.fontSizeSm')
                  : size === 'md'
                    ? t('settings.fontSizeMd')
                    : t('settings.fontSizeLg')
              }
            />
          ))}
        </div>
      </Section>

      {/* Numerals */}
      <Section icon={Type} title={t('settings.numerals')}>
        <div className="grid grid-cols-2 gap-2">
          {NUMERAL_STYLES.map((style) => (
            <ChoiceButton
              key={style}
              active={prefs.numerals === style}
              onClick={() => prefs.setNumerals(style)}
              label={style === 'bn' ? t('settings.numeralsBn') : t('settings.numeralsEn')}
            />
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-muted/60 p-3">
          <p className="mb-1 text-xs text-muted-foreground">{t('settings.previewTitle')}</p>
          <p className="flex items-center justify-between text-sm">
            <span>{t('settings.previewSale')}</span>
            <MoneyText paisa={1234567} className="text-lg font-bold" />
          </p>
        </div>
      </Section>

      {/* Language */}
      <Section icon={Languages} title={t('settings.language')}>
        <div className="grid grid-cols-2 gap-2">
          {(['bn', 'en'] as AppLanguage[]).map((lang) => (
            <ChoiceButton
              key={lang}
              active={language === lang}
              onClick={() => changeLanguage(lang)}
              label={lang === 'bn' ? t('settings.languageBn') : t('settings.languageEn')}
            />
          ))}
        </div>
      </Section>

      <Button variant="ghost" className="w-full" onClick={prefs.reset}>
        {t('settings.resetPrefs')}
      </Button>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="app-card space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon aria-hidden="true" className="size-4" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function ChoiceButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex min-h-touch flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-2 text-sm font-medium transition',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-secondary/40 text-foreground hover:bg-secondary',
      )}
    >
      <span>{label}</span>
      {hint ? <span className="text-xs font-normal opacity-70">{hint}</span> : null}
    </button>
  );
}
