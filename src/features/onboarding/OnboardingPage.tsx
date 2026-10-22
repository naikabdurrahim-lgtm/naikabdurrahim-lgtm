import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MoneyText } from '@/components/common/MoneyText';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { usePreferences, type AppMode, type NumeralStyle } from '@/features/settings/preferences';
import { formatQuantityMilli } from '@/lib/quantity';
import { PackPicker } from '@/features/onboarding/components/PackPicker';
import { packIcon } from '@/features/onboarding/components/packIcons';
import { createShop, OnboardingError } from '@/features/onboarding/api';
import { packHasStockedProducts } from '@/features/onboarding/rules';
import type { AppLanguage } from '@/lib/i18n';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import type { BusinessPack, SampleProduct } from '@/packs';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3 | 4;
const TOTAL_STEPS = 4;

/**
 * Guided onboarding (PROJECT_RULES 3.1 #12): one question per screen, four
 * screens, under five minutes.
 *
 *   1. business type   2. shop name   3. starter products   4. preferences
 *
 * State is local: nothing is written until the final button, so backing out
 * leaves no half-created shop behind.
 */
export function OnboardingPage() {
  const { t, language, changeLanguage } = useAppTranslation('onboarding');
  const { refresh, user } = useAuth();
  const navigate = useNavigate();
  const prefs = usePreferences();

  const [step, setStep] = useState<Step>(1);
  const [pack, setPack] = useState<BusinessPack | null>(null);
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState(user?.fullName ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const samples: SampleProduct[] = pack?.sampleProducts ?? [];
  const chosenSamples = samples.filter((s) => selected.has(s.nameBn));

  const pickPack = (next: BusinessPack) => {
    setPack(next);
    setSelected(new Set(next.sampleProducts.map((s) => s.nameBn)));
  };

  const toggleSample = (name: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const finish = async () => {
    if (!pack || !shopName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createShop({
        name: shopName,
        pack,
        ...(ownerName.trim() ? { ownerDisplayName: ownerName.trim() } : {}),
        sampleProducts: chosenSamples,
      });
      // Re-read memberships so the app knows about the new shop.
      await refresh();
      navigate('/', { replace: true });
    } catch (cause) {
      // The shop exists but its starter products did not. Retrying "create"
      // would make a second shop, so we move on and explain what to do.
      if (cause instanceof OnboardingError && cause.code === 'products_failed') {
        await refresh();
        toast.warning(t('errors.products_failed'));
        navigate('/', { replace: true });
        return;
      }
      const code = cause instanceof OnboardingError ? cause.code : 'unknown';
      setError(t(`errors.${code}`));
    } finally {
      setBusy(false);
    }
  };

  const canGoNext =
    (step === 1 && pack !== null) ||
    (step === 2 && shopName.trim().length >= 2) ||
    step === 3 ||
    step === 4;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center gap-3">
          <span className="text-sm font-semibold">{t('title')}</span>
          <span className="ms-auto text-xs text-muted-foreground">
            {t('step', { current: step, total: TOTAL_STEPS })}
          </span>
        </div>
        <div className="mx-auto mt-2 flex w-full max-w-md gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((index) => (
            <span
              key={index}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                index <= step ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-5">
        {step === 1 ? (
          <section className="space-y-1">
            <h1 className="text-xl font-bold">{t('businessType.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('businessType.hint')}</p>
            <div className="pt-3">
              <PackPicker value={pack?.id ?? null} onChange={pickPack} />
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold">{t('shopName.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('shopName.hint')}</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="shopName" className="block text-sm font-medium">
                {t('shopName.title')}
              </label>
              <input
                id="shopName"
                value={shopName}
                onChange={(event) => setShopName(event.target.value)}
                placeholder={t('shopName.placeholder')}
                maxLength={120}
                autoFocus
                className="min-h-cta w-full rounded-xl border border-input bg-secondary/40 px-3 text-lg outline-none focus-visible:border-primary"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ownerName" className="block text-sm font-medium">
                {t('shopName.ownerLabel')}
              </label>
              <input
                id="ownerName"
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
                placeholder={t('shopName.ownerHint')}
                maxLength={120}
                className="min-h-cta w-full rounded-xl border border-input bg-secondary/40 px-3 text-lg outline-none focus-visible:border-primary"
              />
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-3">
            <div className="space-y-1">
              <h1 className="text-xl font-bold">{t('sampleProducts.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('sampleProducts.hint')}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSelected(new Set(samples.map((s) => s.nameBn)))}
              >
                {t('sampleProducts.selectAll')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
              >
                {t('sampleProducts.clearAll')}
              </Button>
              <span className="ms-auto text-xs text-muted-foreground">
                {t('sampleProducts.selected', { count: selected.size })}
              </span>
            </div>

            <ul className="space-y-2">
              {samples.map((sample) => {
                const isSelected = selected.has(sample.nameBn);
                return (
                  <li key={sample.nameBn}>
                    <button
                      type="button"
                      onClick={() => toggleSample(sample.nameBn)}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border p-3 text-start transition',
                        isSelected
                          ? 'border-primary/60 bg-primary/5'
                          : 'border-border bg-card hover:bg-secondary/40',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'grid size-6 shrink-0 place-items-center rounded-md border',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input bg-transparent',
                        )}
                      >
                        {isSelected ? <Check className="size-4" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {language === 'bn' ? sample.nameBn : sample.nameEn}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {t(`common:units.${sample.unit}`, { ns: 'common' })}
                          {packHasStockedProducts(pack?.id ?? 'general')
                            ? ` · ${formatQuantityMilli(sample.stockMilli, { numerals: prefs.numerals })}`
                            : ''}
                        </span>
                      </span>
                      <MoneyText paisa={sample.sellPaisa} className="text-sm font-semibold" />
                    </button>
                  </li>
                );
              })}
            </ul>

            {selected.size === 0 ? (
              <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                {t('sampleProducts.skip')}
              </p>
            ) : null}
          </section>
        ) : null}

        {step === 4 ? (
          <section className="space-y-5">
            <div className="space-y-1">
              <h1 className="text-xl font-bold">{t('preferences.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('preferences.hint')}</p>
            </div>

            {pack ? (
              <div className="app-card flex items-center gap-3 p-3">
                {(() => {
                  const Icon = packIcon(pack);
                  return (
                    <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                  );
                })()}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {language === 'bn' ? pack.labelBn : pack.labelEn}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{shopName}</p>
                </div>
                <span className="ms-auto text-xs text-muted-foreground">
                  {t('sampleProducts.selected', { count: selected.size })}
                </span>
              </div>
            ) : null}

            <ChoiceGroup
              title={t('preferences.modeTitle')}
              options={[
                { id: 'simple', label: t('common:settings.modeSimple', { ns: 'common' }) },
                { id: 'pro', label: t('common:settings.modePro', { ns: 'common' }) },
              ]}
              value={prefs.mode}
              onChange={(value) => prefs.setMode(value as AppMode)}
            />

            <ChoiceGroup
              title={t('preferences.numeralsTitle')}
              options={[
                { id: 'bn', label: t('common:settings.numeralsBn', { ns: 'common' }) },
                { id: 'en', label: t('common:settings.numeralsEn', { ns: 'common' }) },
              ]}
              value={prefs.numerals}
              onChange={(value) => prefs.setNumerals(value as NumeralStyle)}
            />

            <ChoiceGroup
              title={t('preferences.languageTitle')}
              options={[
                { id: 'bn', label: 'বাংলা' },
                { id: 'en', label: 'English' },
              ]}
              value={language}
              onChange={(value) => {
                changeLanguage(value as AppLanguage);
                prefs.setLanguage(value as AppLanguage);
              }}
            />

            {error ? (
              <p role="alert" className="rounded-xl bg-money-out/10 p-3 text-sm text-money-out">
                {error}
              </p>
            ) : null}
          </section>
        ) : null}
      </main>

      <footer className="sticky bottom-0 border-t border-border/60 bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex w-full max-w-md gap-2">
          {step > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="flex-1"
              onClick={() => setStep((s) => (s - 1) as Step)}
              disabled={busy}
            >
              <ArrowLeft aria-hidden="true" />
              {t('back')}
            </Button>
          ) : null}

          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              size="lg"
              className="flex-[2]"
              disabled={!canGoNext}
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              {t('next')}
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              className="flex-[2]"
              onClick={() => void finish()}
              disabled={busy || !pack || shopName.trim().length < 2}
            >
              {busy ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  {t('creating')}
                </>
              ) : (
                <>
                  <Check aria-hidden="true" />
                  {t('create')}
                </>
              )}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function ChoiceGroup({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={cn(
              'min-h-touch rounded-xl border px-3 text-sm font-medium transition',
              value === option.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-secondary/40 hover:bg-secondary',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
