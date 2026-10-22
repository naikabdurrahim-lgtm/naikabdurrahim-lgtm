import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, KeyRound, Loader2, ShieldCheck, UserPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PhoneInput } from '@/components/common/PhoneInput';
import { PinInput } from '@/components/common/PinInput';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { AuthError } from '@/features/auth/lib/authErrors';
import { saveRecoveryCode } from '@/features/auth/lib/authService';
import { normaliseBdPhone } from '@/features/auth/lib/phone';
import { checkPin, confirmPin, pinStrength } from '@/features/auth/lib/pin';
import { generateRecoveryCode } from '@/features/auth/lib/recoveryCode';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { cn } from '@/lib/utils';

type Step = 'details' | 'recovery';

/**
 * Sign up: name, phone, PIN twice → account created → recovery code shown once.
 *
 * The recovery code step is not skippable by accident: the button says "I have
 * written it down", because a forgotten PIN otherwise has no self-service path.
 */
export function SignUpPage() {
  const { t } = useAppTranslation('auth');
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('details');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedCode, setSavedCode] = useState(false);

  const normalised = normaliseBdPhone(phone);
  const pinCheck = useMemo(
    () => checkPin(pin, { phone: normalised ?? undefined }),
    [pin, normalised],
  );
  const strength = pinStrength(pin);

  const pinProblem = pin.length === 6 && !pinCheck.ok;
  // The first reason is the most actionable one; extra rules are listed under it.
  const pinProblemCode = pinCheck.ok ? null : (pinCheck.problems[0] ?? null);
  const mismatch = pin2.length === 6 && !confirmPin(pin, pin2);
  const canSubmit =
    fullName.trim().length > 1 &&
    Boolean(normalised) &&
    pin.length === 6 &&
    pinCheck.ok &&
    confirmPin(pin, pin2) &&
    !busy;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !normalised) return;

    setBusy(true);
    setErrorCode(null);
    try {
      await signUp({ phone: normalised, pin, fullName: fullName.trim() });

      const code = generateRecoveryCode();
      setRecoveryCode(code);
      try {
        await saveRecoveryCode(code);
      } catch (error) {
        // The account exists and the session is valid; a missing recovery code is
        // recoverable (it can be regenerated), so we do not fail the signup.
        console.error('[auth] could not store the recovery code', error);
      }
      setStep('recovery');
    } catch (error) {
      setErrorCode(error instanceof AuthError ? error.code : 'unknown');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the code is already on screen.
      setCopied(false);
    }
  };

  if (step === 'recovery') {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-8">
          <header className="space-y-2 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-money-in/10 text-money-in">
              <ShieldCheck aria-hidden="true" className="size-7" />
            </span>
            <h1 className="text-2xl font-bold">{t('recovery.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('recovery.intro')}</p>
          </header>

          <div className="app-card space-y-4 p-5 text-center">
            <p
              className="select-all break-words font-mono text-2xl font-bold tracking-[0.18em]"
              aria-label={t('recovery.title')}
            >
              {recoveryCode}
            </p>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => void copyCode()}
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? t('recovery.copied') : t('recovery.copy')}
            </Button>
            <p className="text-xs text-muted-foreground">{t('recovery.body')}</p>
            <p className="rounded-lg bg-warning/10 p-2 text-xs text-warning">
              {t('recovery.warning')}
            </p>
          </div>

          {/* Deliberately checks before continue: the code is shown once only,
              and a shopkeeper who loses it cannot reset the PIN alone. */}
          <label className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={savedCode}
              onChange={(event) => setSavedCode(event.target.checked)}
              className="size-5 rounded border-input"
            />
            {t('recovery.saved')}
          </label>

          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={!savedCode}
            onClick={() => navigate('/onboarding', { replace: true })}
          >
            <Check aria-hidden="true" />
            {t('recovery.continue')}
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-6">
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link to="/sign-in">
            <ArrowLeft aria-hidden="true" />
            {t('common:actions.back', { ns: 'common' })}
          </Link>
        </Button>

        <header className="space-y-2 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <UserPlus aria-hidden="true" className="size-7" />
          </span>
          <h1 className="text-2xl font-bold">{t('signUp')}</h1>
          <p className="text-sm text-muted-foreground">{t('welcomeHint')}</p>
        </header>

        <form onSubmit={handleCreate} className="space-y-5" noValidate>
          <div className="space-y-2">
            <label htmlFor="fullName" className="block text-sm font-medium">
              {t('nameLabel')}
            </label>
            <input
              id="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder={t('nameHint')}
              autoComplete="name"
              maxLength={120}
              className="min-h-cta w-full rounded-xl border border-input bg-secondary/40 px-3 text-lg outline-none focus-visible:border-primary"
            />
          </div>

          <PhoneInput
            label={t('phoneLabel')}
            hint={t('phoneHint')}
            value={phone}
            onChange={(value) => {
              setPhone(value);
              setErrorCode(null);
            }}
          />

          <div className="space-y-2">
            <PinInput
              label={t('newPinLabel')}
              value={pin}
              onChange={(value) => {
                setPin(value);
                setErrorCode(null);
              }}
              purpose="new-pin"
              invalid={pinProblem}
              disabled={busy}
            />
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1" aria-hidden="true">
                {[1, 2, 3].map((level) => (
                  <span
                    key={level}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-colors',
                      strength >= level
                        ? strength === 1
                          ? 'bg-money-out'
                          : strength === 2
                            ? 'bg-warning'
                            : 'bg-money-in'
                        : 'bg-muted',
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {strength <= 1
                  ? t('strengthWeak')
                  : strength === 2
                    ? t('strengthFair')
                    : t('strengthStrong')}
              </span>
            </div>
            {pinProblemCode ? (
              <p role="alert" className="text-sm text-money-out">
                {t(`pinProblems.${pinProblemCode}`)}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">{t('pinRules')}</p>
          </div>

          <div className="space-y-2">
            <PinInput
              label={t('confirmPinLabel')}
              value={pin2}
              onChange={(value) => {
                setPin2(value);
                setErrorCode(null);
              }}
              purpose="new-pin"
              invalid={mismatch}
              disabled={busy}
              id="pin2"
            />
            {mismatch ? <p className="text-sm text-money-out">{t('pinMismatch')}</p> : null}
          </div>

          {errorCode ? (
            <p role="alert" className="rounded-xl bg-money-out/10 p-3 text-sm text-money-out">
              {t(`errors.${errorCode}`)}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
            {busy ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin" />
                {t('creating')}
              </>
            ) : (
              <>
                <KeyRound aria-hidden="true" />
                {t('signUpButton')}
              </>
            )}
          </Button>
        </form>

        <div className="space-y-2 text-center text-sm">
          <p className="text-muted-foreground">{t('hasAccount')}</p>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link to="/sign-in">{t('goSignIn')}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
