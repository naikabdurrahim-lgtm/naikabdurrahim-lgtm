import { Check } from 'lucide-react';
import { PACKS, type BusinessPack, type PackId } from '@/packs';
import { usePreferences } from '@/features/settings/preferences';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { cn } from '@/lib/utils';
import { packIcon, PACK_TONES } from './packIcons';

type PackPickerProps = {
  value: PackId | null;
  onChange: (pack: BusinessPack) => void;
};

/**
 * Six big cards, each with an icon, a Bangla name and a plain-language hint.
 * Two columns on a phone so all six are visible without scrolling far, and the
 * selected card is obvious in three ways (border, tick, background) — never by
 * colour alone (PROJECT_RULES 3.1 #15).
 */
export function PackPicker({ value, onChange }: PackPickerProps) {
  const { t, language } = useAppTranslation('onboarding');
  const numerals = usePreferences((s) => s.numerals);

  return (
    <div className="space-y-3">
      <div
        className="grid grid-cols-2 gap-3"
        role="radiogroup"
        aria-label={t('businessType.title')}
      >
        {PACKS.map((pack, index) => {
          const Icon = packIcon(pack);
          const selected = value === pack.id;
          return (
            <button
              key={pack.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(pack)}
              className={cn(
                'relative flex min-h-[7.5rem] flex-col justify-between rounded-2xl border-2 p-3 text-start transition active:scale-[0.98]',
                selected
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-border/80 hover:bg-secondary/40',
              )}
            >
              <span
                className={cn('grid size-11 place-items-center rounded-xl', PACK_TONES[pack.tone])}
              >
                <Icon aria-hidden="true" className="size-6" />
              </span>
              {selected ? (
                <span className="absolute end-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check aria-hidden="true" className="size-4" />
                </span>
              ) : (
                <span className="absolute end-2 top-2 text-xs text-muted-foreground">
                  {numerals === 'bn' ? ['১', '২', '৩', '৪', '৫', '৬'][index] : index + 1}
                </span>
              )}
              <span className="space-y-0.5">
                <span className="block text-sm font-semibold leading-tight">
                  {language === 'bn' ? pack.labelBn : pack.labelEn}
                </span>
                <span className="block text-xs leading-tight opacity-70">
                  {language === 'bn' ? pack.hintBn : pack.hintEn}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
